"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Mic, Loader2, Menu, XCircle, Sun, Moon, Copy, Check, FileDown, FileText } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { CheckCircle2 } from 'lucide-react'
import jsPDF from "jspdf"
import { Document, Packer, Paragraph, TextRun } from "docx"
import { saveAs } from "file-saver"

type Question = {
  id: string
  text: string
}

type Session = {
  id: string
  jobDescription: string
  questions: Question[]
  createdAt: number
  role?: string
  company?: string
}

type AnalysisResult = {
  overallScore: number
  passed: boolean
  questionResults: {
    question: string
    score: number
    feedback: string
    passed: boolean
    notInList: boolean
    hardSkills?: string[]
    softSkills?: string[]
  }[]
}

type AudioAnalysisResponse = {
  transcription: string
  analysis: AnalysisResult
}

// Add a helper to generate session titles
function getSessionTitle(index: number, isNew = false) {
  return isNew ? `New Interview Assis ${index + 1}` : `Interview Assis ${index + 1}`
}

type FileUploadEvent = React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLLabelElement>;

// Add this helper function at the top level, before the Home component
function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [url, setUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [showUploadInput, setShowUploadInput] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isUrlValid, setIsUrlValid] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [copied, setCopied] = useState(false);
  const questionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for saved theme preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initialTheme = savedTheme || systemTheme;
    setTheme(initialTheme as 'light' | 'dark');
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    const urlRegex = /\/role\/([^/]+)\/company\/([^/]+)/;
    const urlMatch = urlRegex.exec(window.location.href);
    if (urlMatch) {
      const role = urlMatch[1];
      const company = urlMatch[2];
      setUrl(`Role: ${role}\nCompany: ${company}\n\n`);
    }
  }, []);

  const stopProgressAnimation = () => {
    // Empty function since we removed the progress animation state
  };

  useEffect(() => {
    if (sessions.length > 0) {
      // No action needed since we removed the progress animation state
    }
    return () => {
      stopProgressAnimation();
    };
  }, [sessions]);

  // Load sessions from MongoDB on mount
  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch('/api/sessions');
        const data = await res.json();

        if (Array.isArray(data)) {
          const sessionsWithQuestions = data.filter(session => session.questions && session.questions.length > 0);
          setSessions(sessionsWithQuestions);
          if (sessionsWithQuestions.length > 0) {
            setActiveSessionId(sessionsWithQuestions[0].id);
          }
        } else {
          setSessions([]);
        }
      } catch {
        setSessions([]);
      } finally {
        setIsInitialLoading(false);
      }
    }
    fetchSessions();
  }, []);

  // When activeSessionId changes, update UI
  useEffect(() => {
    if (!activeSessionId) return;
    const session = sessions.find(s => s.id === activeSessionId);
    if (session) {
      setUrl(session.jobDescription);
      setQuestions(session.questions);
      // Always clear analysis results when switching sessions
      setAnalysisResult(null);
      stopProgressAnimation();
    }
  }, [activeSessionId, sessions]);

  const validateUrl = (input: string) => {
    // If input is empty, clear error and return false
    if (!input.trim()) {
      setUrlError(null);
      setIsUrlValid(false);
      return false;
    }

    try {
      // Check if the input is a valid URL
      new URL(input);
      
      // Check if the URL has a valid protocol (http or https)
      if (!input.startsWith('http://') && !input.startsWith('https://')) {
        setUrlError('Please enter a valid URL starting with http:// or https://');
        setIsUrlValid(false);
        return false;
      }
      
      // Check if the URL has a valid domain (at least one dot)
      if (!input.includes('.')) {
        setUrlError('Please enter a valid URL with a domain name');
        setIsUrlValid(false);
        return false;
      }
      
      setUrlError(null);
      setIsUrlValid(true);
      return true;
    } catch {
      // If the URL is incomplete (e.g., just "http://" or "https://"), show a helpful message
      if (input.startsWith('http://') || input.startsWith('https://')) {
        setUrlError('Please complete the URL with a domain name');
      } else {
        setUrlError('Please enter a valid URL');
      }
      setIsUrlValid(false);
      return false;
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    validateUrl(newUrl);
  };

  const handleUrlBlur = () => {
    validateUrl(url);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    await generateQuestions();
  };

  const generateQuestions = async () => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to generate questions');
      }

      const data = await response.json();

      const generatedQuestions: Question[] = (data.questions || []).map((text: string, index: number) => ({
        id: `q${index + 1}`,
        text
      }));

      // Create a new session if none exists
      if (!activeSessionId) {
        const newSession: Session = {
          id: generateUniqueId(),
          jobDescription: url,
          questions: generatedQuestions,
          createdAt: Date.now(),
        };

        // Save to MongoDB
        const saveRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSession),
        });

        if (!saveRes.ok) {
          await saveRes.text();
          return;
        }

        const savedSession = await saveRes.json();

        // Update sessions list with the new session
        setSessions(prev => [savedSession, ...prev]);
        setActiveSessionId(savedSession.id);
        setQuestions(generatedQuestions);
      } else {
        // Update the current session with the generated questions
        const updatedSession = {
          ...sessions.find(s => s.id === activeSessionId),
          jobDescription: url,
          questions: generatedQuestions
        };

        // Save to MongoDB
        const saveRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedSession),
        });

        if (!saveRes.ok) {
          await saveRes.text();
          return;
        }

        const savedSession = await saveRes.json();

        // Update sessions list with the updated session
        const updatedSessions = sessions.map(session =>
          session.id === activeSessionId ? savedSession : session
        );
        setSessions(updatedSessions);
        setQuestions(generatedQuestions);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  // Start a new session
  const handleNewSession = () => {
    // Check if there's already an empty session
    const hasEmptySession = sessions.some(session =>
      session.jobDescription === "" &&
      session.questions.length === 0
    );

    if (hasEmptySession) {
      // Find the empty session and make it active
      const emptySession = sessions.find(session =>
        session.jobDescription === "" &&
        session.questions.length === 0
      );
      if (emptySession) {
        setActiveSessionId(emptySession.id);
        setUrl("");
        setQuestions([]);
        setAnalysisResult(null);
        stopProgressAnimation();
        setIsSidebarOpen(false);
      }
      return;
    }

    const newSession: Session = {
      id: generateUniqueId(),
      jobDescription: "",
      questions: [],
      createdAt: Date.now(),
    }

    // Update sessions list with the new session
    setSessions(prev => [newSession, ...prev]);

    // Update active session and clear related states
    setActiveSessionId(newSession.id);
    setUrl("");
    setQuestions([]);
    setAnalysisResult(null);
    stopProgressAnimation();
    setIsSidebarOpen(false);
  }

  // Delete session handler
  const handleDeleteSession = async () => {
    if (!deleteSessionId) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/sessions?id=${deleteSessionId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete session');
      }

      // Refetch sessions after successful deletion
      const sessionsResponse = await fetch('/api/sessions');
      if (!sessionsResponse.ok) {
        throw new Error('Failed to fetch updated sessions');
      }

      const updatedSessions = await sessionsResponse.json();
      setSessions(updatedSessions);

      // If the deleted session was active, clear selection
      if (activeSessionId === deleteSessionId) {
        setActiveSessionId(updatedSessions.length > 0 ? updatedSessions[0].id : null);
        setUrl("");
        setQuestions([]);
      }

    } catch {
    } finally {
      setIsDeleting(false);
      setDeleteSessionId(null);
    }
  };

  const handleFileUpload = async (e: FileUploadEvent) => {
    let selectedFile: File | null = null;

    if ('dataTransfer' in e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.files) {
        selectedFile = e.dataTransfer.files[0];
      }
    } else {
      selectedFile = e.target.files?.[0] || null;
    }

    if (selectedFile) {
      setIsUploading(true);
      setShowUploadInput(false);

      try {
        const formData = new FormData();
        formData.append('audio', selectedFile);
        formData.append('questions', JSON.stringify(questions));

        const response = await fetch('/api/analyze-audio', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to analyze audio');
        }

        const result: AudioAnalysisResponse = await response.json();
        setAnalysisResult(result.analysis);
      } catch {
      } finally {
        setIsUploading(false);
        setIsGenerating(false);
        setShowUploadInput(true);
      }
    }
  };

  const handleCancelUpload = () => {
    stopProgressAnimation();
    setIsUploading(false);
    setAnalysisResult(null);
    setShowUploadInput(true);
  };

  const handleCancelGeneration = () => {
    setIsLoading(false);
    setQuestions([]);
    setShowUploadInput(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileUpload(e);
  }

  // Handler for Word export
  const handleExportWord = async () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "Interview Questions", bold: true, size: 32 }),
              ],
              spacing: { after: 300 },
            }),
            ...questions.map((q, i) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `${i + 1}. ${q.text}`, size: 28 }),
                ],
                spacing: { after: 200 },
              })
            ),
          ],
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "interview-questions.docx");
  };

  const handleExportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Interview Questions", 10, 20);
    doc.setFontSize(12);

    let y = 30;
    const lineHeight = 10;
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginBottom = 20;

    questions.forEach((q, i) => {
      if (y > pageHeight - marginBottom) {
        doc.addPage();
        y = 20; // Reset y for new page
      }
      doc.text(`${i + 1}. ${q.text}`, 10, y);
      y += lineHeight;
    });

    doc.save("interview-questions.pdf");
  };

  // Sidebar rendering
  const renderSidebar = () => {
    const isProcessing = isLoading || isUploading;
    
    return (
      <aside className={`fixed md:relative h-full w-full md:w-64 bg-white dark:bg-gray-900 border-b md:border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out z-[60]
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="sticky top-0 left-0 right-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between p-4">
          <span className="font-bold text-lg text-gray-900 dark:text-white">Sessions</span>
          <div className="flex items-center gap-2">
            <button
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-base font-medium transition-colors duration-150 shadow-sm cursor-pointer"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-base font-medium transition-colors duration-150 shadow-sm cursor-pointer"
              title="New Session"
              onClick={handleNewSession}
              disabled={isProcessing}
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-base font-medium transition-colors duration-150 shadow-sm cursor-pointer"
              onClick={() => setIsSidebarOpen(false)}
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <div className="text-gray-400 dark:text-gray-500 text-center mt-8">No sessions yet</div>
          )}
          {Array.isArray(sessions) && sessions.map((session, idx) => {
            const date = new Date(session.createdAt);
            const formattedDate = isNaN(date.getTime())
              ? 'Invalid date'
              : date.toLocaleString();

            const isCurrentSession = activeSessionId === session.id;

            return (
              <div key={`${session.id}-${idx}`} className="group">
                <button
                  className={`w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-200 
                    ${isCurrentSession ? 'bg-gray-100 dark:bg-gray-800 font-semibold' : ''}
                    ${isProcessing && !isCurrentSession ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (!isProcessing || isCurrentSession) {
                      setActiveSessionId(session.id);
                      setIsSidebarOpen(false);
                    }
                  }}
                  disabled={isProcessing && !isCurrentSession}
                  title={isProcessing && !isCurrentSession ? "Please wait until processing is complete" : ""}
                >
                  <div>
                    <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {getSessionTitle(sessions.length - idx - 1)}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{formattedDate}</div>
                  </div>
                  <span
                    className={`p-2 transition-all duration-200 bg-transparent cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full
                      ${isProcessing ? 'opacity-0' : ''}`}
                    title="Delete session"
                    onClick={(e) => { 
                      e.preventDefault();
                      e.stopPropagation(); 
                      if (!isProcessing) {
                        setDeleteSessionId(session.id);
                        setIsSidebarOpen(false); // Close sidebar when delete dialog opens
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200" />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteSessionId} onOpenChange={(open) => {
          if (!open && !isProcessing) {
            setDeleteSessionId(null);
          }
        }}>
          <DialogContent className="cursor-default bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
            <DialogHeader>
              <DialogTitle>Delete Session</DialogTitle>
            </DialogHeader>
            <div className="text-gray-600 dark:text-gray-300">Are you sure you want to delete this session? This action cannot be undone.</div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteSessionId(null)}
                className="cursor-pointer"
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteSession}
                className="cursor-pointer"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </div>
                ) : (
                  "Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </aside>
    );
  };

  // Add skeleton loading components
  const renderSkeletonSidebar = () => (
    <aside className={`fixed md:relative h-full w-full md:w-64 bg-white dark:bg-gray-900 border-b md:border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out z-[60] -translate-x-full md:translate-x-0`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    </aside>
  );

  const renderSkeletonMainContent = () => (
    <main className="flex-1 p-8 overflow-hidden">
      <div className="w-full h-full" style={{ maxWidth: 900 }}>
        <div className="bg-white rounded-2xl shadow-lg p-8 h-full flex flex-col">
          <div className="flex-none">
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mx-auto mb-2"></div>
            <div className="h-4 w-full md:w-96 bg-gray-200 rounded animate-pulse mx-auto mb-6 border-b-2 border-gray-200 md:border-0"></div>
            <div className="flex flex-col gap-3 mb-8">
              <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );

  // Main content rendering
  return (
    <div className="flex h-screen relative bg-gray-50 dark:bg-gray-950">
      {isInitialLoading ? renderSkeletonSidebar() : renderSidebar()}
      <div className="flex-1 flex flex-col overflow-y-auto md:overflow-hidden">
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-gray-50 dark:bg-gray-950 z-[55] border-b border-gray-200 dark:border-gray-700">
          <button
            className={`absolute top-4 left-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 ${isSidebarOpen ? 'hidden' : 'block'}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <button
            className={`absolute top-4 left-16 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-gray-600 dark:text-gray-300 ${isSidebarOpen ? 'hidden' : 'block'}`}
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
        </div>
        {isInitialLoading ? renderSkeletonMainContent() : (
          <main className="flex-1 p-0 md:p-8 mt-16 md:mt-0">
            <div className="w-full h-full md:max-w-[900px]">
              <div className="bg-white dark:bg-gray-900 rounded-none md:rounded-2xl shadow-lg p-4 md:p-8 h-full flex flex-col">
                <div className="flex-none">
                  <h1 className="text-2xl md:text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white">Interview Questions Generator</h1>
                  <p className="text-gray-600 dark:text-gray-400 text-center mb-6 text-sm md:text-base">
                    Paste a job posting URL to generate tailored interview questions.
                  </p>
                  <div className="flex flex-col gap-3 mb-4">
                    <Input
                      type="text"
                      placeholder="Enter the job description link: e.g. https://jobs.com/software-engineer-123456"
                      className={`text-base md:text-lg h-12 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 ${urlError ? 'border-gray-400 dark:border-gray-500' : ''}`}
                      value={url}
                      onChange={handleUrlChange}
                      onBlur={handleUrlBlur}
                      disabled={isLoading || questions.length > 0}
                    />
                    {urlError && (
                      <p className="text-gray-800 dark:text-gray-200 text-sm mt-1 font-medium">{urlError}</p>
                    )}
                    <Button
                      onClick={handleSubmit}
                      disabled={!isUrlValid || isLoading || questions.length > 0}
                      className="text-base md:text-lg px-6 h-12 cursor-pointer"
                    >
                      {isLoading ? "Generating..." : "Generate"}
                    </Button>

                    {isLoading && (
                      <div className="relative flex flex-col items-center justify-center py-8">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-0 right-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer text-base"
                          onClick={handleCancelGeneration}
                        >
                          Cancel
                        </Button>
                        <Loader2 className="h-10 w-10 animate-spin text-gray-600 dark:text-gray-400 mb-4" />
                        <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">Generating questions...</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">This may take a few moments</p>
                      </div>
                    )}

                    {(questions.length > 0 || analysisResult) && showUploadInput && (
                      <div className="mt-4">
                        <label
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Mic className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" />
                            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">MP3, WAV, M4A (MAX. 10MB)</p>
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept="audio/*"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                          />
                        </label>
                        {/* Copy questions icon/button and export buttons */}
                        {questions.length > 0 && (
                          <div className="flex justify-end mt-2 -mb-2 gap-2">
                            <button
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-base font-medium transition-colors duration-150 shadow-sm cursor-pointer"
                              onClick={async () => {
                                const text = questions.map(q => q.text).join('\n');
                                await navigator.clipboard.writeText(text);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1500);
                              }}
                              title="Copy list"
                              type="button"
                            >
                              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                              <span className="hidden md:inline">Copy list</span>
                            </button>
                            <button
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-base font-medium transition-colors duration-150 shadow-sm cursor-pointer"
                              onClick={handleExportPdf}
                              title="Download PDF"
                              type="button"
                            >
                              <FileDown className="w-5 h-5" />
                              <span className="hidden md:inline">Download PDF</span>
                            </button>
                            <button
                              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-base font-medium transition-colors duration-150 shadow-sm cursor-pointer"
                              onClick={handleExportWord}
                              title="Download Word"
                              type="button"
                            >
                              <FileText className="w-5 h-5" />
                              <span className="hidden md:inline">Download Word</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {isUploading && (
                      <div className="relative flex flex-col items-center justify-center py-8">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-0 right-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer text-base"
                          onClick={handleCancelUpload}
                        >
                          Cancel
                        </Button>
                        <Loader2 className="h-10 w-10 animate-spin text-gray-600 dark:text-gray-400 mb-4" />
                        <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg">Processing your audio...</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">This may take a few moments</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-0 md:max-h-[calc(100vh-400px)] overflow-y-auto">
                  {isGenerating && (
                    <div className="text-center py-8">
                      <div className="mb-4">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                          <div
                            className="bg-gray-600 dark:bg-gray-500 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: '100%' }}
                          ></div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Generating questions...</p>
                      </div>
                    </div>
                  )}

                  {analysisResult && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          {analysisResult.passed ? (
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-500" />
                          )}
                          <span className="font-semibold text-lg text-gray-900 dark:text-white">
                            {analysisResult.passed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {analysisResult.overallScore}/100
                        </div>
                      </div>

                      {/* Overview Section */}
                      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
                        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Candidate Overview</h3>
                        <div className="space-y-2">
                          <p className="text-gray-700 dark:text-gray-300">
                            {analysisResult.passed ? (
                              "The candidate has demonstrated strong suitability for this role based on their responses. They showed good technical knowledge and communication skills."
                            ) : (
                              "The candidate's responses indicate areas for improvement to better match the role requirements."
                            )}
                          </p>
                          <div className="mt-4">
                            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Hard Skills Assessment:</h4>
                            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                              {analysisResult.questionResults
                                .filter(result => result.passed)
                                .flatMap(result => result.hardSkills || [])
                                .filter((skill, index, self) => self.indexOf(skill) === index)
                                .map((skill, index) => (
                                  <li key={index}>{skill}</li>
                                ))}
                            </ul>
                          </div>
                          <div className="mt-4">
                            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Soft Skills Assessment:</h4>
                            <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                              {analysisResult.questionResults
                                .filter(result => result.passed)
                                .flatMap(result => result.softSkills || [])
                                .filter((skill, index, self) => self.indexOf(skill) === index)
                                .map((skill, index) => (
                                  <li key={index}>{skill}</li>
                                ))}
                            </ul>
                          </div>
                          {!analysisResult.passed && (
                            <div className="mt-4">
                              <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Areas for Improvement:</h4>
                              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-1">
                                {analysisResult.questionResults
                                  .filter(result => !result.passed)
                                  .map((result, index) => (
                                    <li key={index}>
                                      <span className="font-medium">{result.question.split('?')[0]}:</span> {result.feedback}
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {analysisResult.questionResults.map((result, index) => (
                          <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-gray-900 dark:text-white">Question {index + 1}</h3>
                                  {result.notInList && (
                                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                                      Extra question
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mt-1">{result.question}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {result.passed ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500" />
                                )}
                                <span className="text-gray-900 dark:text-white">{result.score}/100</span>
                              </div>
                            </div>
                            <div className="mt-3">
                              <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-1">Feedback:</h4>
                              <p className="text-gray-600 dark:text-gray-400">{result.feedback}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {questions.length > 0 && (
                    <div ref={questionsRef} className="space-y-3">
                      {questions.map((q, i) => (
                        <div key={q.id} className="space-y-2">
                          <div className="flex items-center gap-3 p-3.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 dark:bg-gray-700 text-white font-semibold">
                              {i + 1}
                            </span>
                            <span className="text-base flex items-center h-full text-gray-900 dark:text-white">{q.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}
