"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Mic, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { CheckCircle2, XCircle } from 'lucide-react'

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
      console.log("Fetching sessions from API...");
      try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        console.log("Received sessions data:", data);

        if (Array.isArray(data)) {
          const sessionsWithQuestions = data.filter(session => session.questions && session.questions.length > 0);
          console.log(`Setting ${sessionsWithQuestions.length} sessions with questions:`,
            sessionsWithQuestions.map(s => ({
              id: s.id,
              timestamp: s.createdAt,
              date: new Date(s.createdAt).toISOString(),
              questionCount: s.questions.length
            }))
          );
          setSessions(sessionsWithQuestions);
          if (sessionsWithQuestions.length > 0) {
            console.log("Setting active session ID:", sessionsWithQuestions[0].id);
            setActiveSessionId(sessionsWithQuestions[0].id);
          }
        } else {
          console.error("Failed to load sessions:", data.error);
          setSessions([]);
        }
      } catch (error) {
        console.error("Error fetching sessions:", error);
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
      console.log("Starting question generation for URL:", url);

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
      console.log("Received questions from API:", data.questions);

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
          const errorText = await saveRes.text();
          console.error('Save failed:', errorText);
          // setError('Failed to save session to database. Please check your backend/API.');
          return;
        }

        const savedSession = await saveRes.json();
        console.log("New session created successfully:", {
          id: savedSession.id,
          timestamp: savedSession.createdAt,
          date: new Date(savedSession.createdAt).toISOString()
        });

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
          const errorText = await saveRes.text();
          console.error('Save failed:', errorText);
          // setError('Failed to save session to database. Please check your backend/API.');
          return;
        }

        const savedSession = await saveRes.json();
        console.log("Session updated successfully:", {
          id: savedSession.id,
          timestamp: savedSession.createdAt,
          date: new Date(savedSession.createdAt).toISOString()
        });

        // Update sessions list with the updated session
        const updatedSessions = sessions.map(session =>
          session.id === activeSessionId ? savedSession : session
        );
        setSessions(updatedSessions);
        setQuestions(generatedQuestions);
      }

      // setError(null);
    } catch (error) {
      console.error('Error in generateQuestions:', error);
      // setError('Failed to generate questions. Please check your backend/API.');
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
      }
      return;
    }

    console.log("Creating new empty session...");
    const newSession: Session = {
      id: generateUniqueId(),
      jobDescription: "",
      questions: [],
      createdAt: Date.now(),
    }
    console.log("New session created:", {
      id: newSession.id,
      timestamp: newSession.createdAt,
      date: new Date(newSession.createdAt).toISOString()
    });

    // Update sessions list with the new session
    setSessions(prev => [newSession, ...prev]);

    // Update active session and clear related states
    setActiveSessionId(newSession.id);
    setUrl("");
    setQuestions([]);
    setAnalysisResult(null);
    stopProgressAnimation();
  }

  // Delete session handler
  const handleDeleteSession = async () => {
    if (!deleteSessionId) return;

    try {
      setIsDeleting(true);
      console.log("Deleting session:", deleteSessionId);
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
      console.log("Updated sessions after deletion:", updatedSessions);

      setSessions(updatedSessions);

      // If the deleted session was active, clear selection
      if (activeSessionId === deleteSessionId) {
        setActiveSessionId(updatedSessions.length > 0 ? updatedSessions[0].id : null);
        setUrl("");
        setQuestions([]);
      }

    } catch (err) {
      console.error("Error deleting session:", err);
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

        console.log('Questions being sent to API:', questions.map(q => q.text));

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
        // Error handling removed since we're not using the error
      } finally {
        setIsUploading(false);
        setIsGenerating(false);
      }
    }
  };

  const handleCancelUpload = () => {
    stopProgressAnimation();
    setIsUploading(false);
    setAnalysisResult(null);
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

  // Sidebar rendering
  const renderSidebar = () => {
    console.log("Rendering sidebar with sessions:", sessions);
    const isProcessing = isLoading || isUploading;
    
    return (
      <aside className="h-full w-64 bg-white border-r flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-bold text-lg">Sessions</span>
          <button
            className="rounded-full p-2 hover:bg-gray-100 cursor-pointer"
            title="New Session"
            onClick={handleNewSession}
            disabled={isProcessing}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <div className="text-gray-400 text-center mt-8">No sessions yet</div>
          )}
          {Array.isArray(sessions) && sessions.map((session, idx) => {
            console.log("Rendering session:", session);
            const date = new Date(session.createdAt);
            const formattedDate = isNaN(date.getTime())
              ? 'Invalid date'
              : date.toLocaleString();

            const isCurrentSession = activeSessionId === session.id;

            return (
              <div key={`${session.id}-${idx}`} className="group">
                <button
                  className={`w-full flex items-center justify-between px-4 py-3 border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200 
                    ${isCurrentSession ? 'bg-gray-100 font-semibold' : ''}
                    ${isProcessing && !isCurrentSession ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => {
                    if (!isProcessing || isCurrentSession) {
                      setActiveSessionId(session.id);
                    }
                  }}
                  disabled={isProcessing && !isCurrentSession}
                  title={isProcessing && !isCurrentSession ? "Please wait until processing is complete" : ""}
                >
                  <div>
                    <div className="truncate text-sm font-medium">
                      {getSessionTitle(sessions.length - idx - 1)}
                    </div>
                    <div className="text-xs text-gray-400">{formattedDate}</div>
                  </div>
                  <span
                    className={`p-2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-transparent cursor-pointer hover:bg-gray-100 rounded-full
                      ${isProcessing ? 'opacity-0' : ''}`}
                    title="Delete session"
                    onClick={e => { 
                      e.stopPropagation(); 
                      if (!isProcessing) {
                        setDeleteSessionId(session.id); 
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-gray-600 hover:text-gray-800 transition-colors duration-200" />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteSessionId} onOpenChange={() => !isProcessing && setDeleteSessionId(null)}>
          <DialogContent className="cursor-default">
            <DialogHeader>
              <DialogTitle>Delete Session</DialogTitle>
            </DialogHeader>
            <div>Are you sure you want to delete this session? This action cannot be undone.</div>
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
    <aside className="h-full w-64 bg-white border-r flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 border rounded-lg">
            <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse"></div>
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
            <div className="h-4 w-96 bg-gray-200 rounded animate-pulse mx-auto mb-6"></div>
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
    <div className="flex h-screen">
      {isInitialLoading ? renderSkeletonSidebar() : renderSidebar()}
      {isInitialLoading ? renderSkeletonMainContent() : (
        <main className="flex-1 p-8 overflow-hidden">
          <div className="w-full h-full" style={{ maxWidth: 900 }}>
            <div className="bg-white rounded-2xl shadow-lg p-8 h-full flex flex-col">
              <div className="flex-none">
                <h1 className="text-3xl font-bold text-center mb-2">Interview Questions Generator</h1>
                <p className="text-gray-600 text-center mb-6">
                  Enter a job description or keywords to generate tailored interview questions.
                </p>
                <div className="flex flex-col gap-3 mb-8">
                  <Input
                    type="text"
                    placeholder="Enter the job description link: e.g. https://jobs.com/software-engineer-123456"
                    className={`text-lg h-12 ${urlError ? 'border-gray-300' : ''}`}
                    value={url}
                    onChange={handleUrlChange}
                    onBlur={handleUrlBlur}
                    disabled={isLoading || questions.length > 0}
                  />
                  {urlError && (
                    <p className="text-gray-800 text-sm mt-1 font-medium">{urlError}</p>
                  )}
                  <Button
                    onClick={handleSubmit}
                    disabled={!isUrlValid || isLoading || questions.length > 0}
                    className="text-lg px-6 h-12 cursor-pointer"
                  >
                    {isLoading ? "Generating..." : "Generate"}
                  </Button>

                  {isLoading && (
                    <div className="relative flex flex-col items-center justify-center py-8">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-0 right-0 text-gray-500 hover:text-gray-700 cursor-pointer text-base"
                        onClick={() => {
                          setIsLoading(false);
                          setQuestions([]);
                        }}
                      >
                        Cancel
                      </Button>
                      <Loader2 className="h-10 w-10 animate-spin text-gray-600 mb-4" />
                      <p className="text-gray-600 text-lg">Generating questions...</p>
                      <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                    </div>
                  )}

                  {questions.length > 0 && showUploadInput && (
                    <div className="mt-4">
                      <label
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Mic className="w-8 h-8 mb-4 text-gray-500" />
                          <p className="mb-2 text-sm text-gray-500">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">MP3, WAV, M4A (MAX. 10MB)</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="audio/*"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {isUploading && (
                  <div className="relative flex flex-col items-center justify-center py-8">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-0 right-0 text-gray-500 hover:text-gray-700 cursor-pointer text-base"
                      onClick={handleCancelUpload}
                    >
                      Cancel
                    </Button>
                    <Loader2 className="h-10 w-10 animate-spin text-gray-600 mb-4" />
                    <p className="text-gray-600 text-lg">Processing your audio...</p>
                    <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                  </div>
                )}

                {isGenerating && (
                  <div className="text-center py-8">
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-gray-600 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: '100%' }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">Generating questions...</p>
                    </div>
                  </div>
                )}

                {analysisResult && (
                  <div className="mt-8 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {analysisResult.passed ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-500" />
                        )}
                        <span className="font-semibold text-lg">
                          {analysisResult.passed ? 'Passed' : 'Failed'}
                        </span>
                      </div>
                      <div className="text-2xl font-bold">
                        {analysisResult.overallScore}/100
                      </div>
                    </div>

                    {/* Overview Section */}
                    <div className="p-4 border rounded-lg bg-white">
                      <h3 className="text-lg font-semibold mb-3">Candidate Overview</h3>
                      <div className="space-y-2">
                        <p className="text-gray-700">
                          {analysisResult.passed ? (
                            "The candidate has demonstrated strong suitability for this role based on their responses. They showed good technical knowledge and communication skills."
                          ) : (
                            "The candidate's responses indicate areas for improvement to better match the role requirements."
                          )}
                        </p>
                        <div className="mt-4">
                          <h4 className="font-medium text-sm text-gray-700 mb-2">Hard Skills Assessment:</h4>
                          <ul className="list-disc list-inside text-gray-600 space-y-1">
                            {analysisResult.questionResults
                              .filter(result => result.passed)
                              .flatMap(result => result.hardSkills || [])
                              .filter((skill, index, self) => self.indexOf(skill) === index) // Remove duplicates
                              .map((skill, index) => (
                                <li key={index}>{skill}</li>
                              ))}
                          </ul>
                        </div>
                        <div className="mt-4">
                          <h4 className="font-medium text-sm text-gray-700 mb-2">Soft Skills Assessment:</h4>
                          <ul className="list-disc list-inside text-gray-600 space-y-1">
                            {analysisResult.questionResults
                              .filter(result => result.passed)
                              .flatMap(result => result.softSkills || [])
                              .filter((skill, index, self) => self.indexOf(skill) === index) // Remove duplicates
                              .map((skill, index) => (
                                <li key={index}>{skill}</li>
                              ))}
                          </ul>
                        </div>
                        {!analysisResult.passed && (
                          <div className="mt-4">
                            <h4 className="font-medium text-sm text-gray-700 mb-2">Areas for Improvement:</h4>
                            <ul className="list-disc list-inside text-gray-600 space-y-1">
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
                        <div key={index} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">Question {index + 1}</h3>
                                {result.notInList && (
                                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                    Extra question
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-600 mt-1">{result.question}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {result.passed ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                              )}
                              <span>{result.score}/100</span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <h4 className="font-medium text-sm text-gray-700 mb-1">Feedback:</h4>
                            <p className="text-gray-600">{result.feedback}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {questions.length > 0 && (
                  <div className="space-y-3 mt-8">
                    {questions.map((q, i) => (
                      <div key={q.id} className="space-y-2">
                        <div className="flex items-center gap-3 p-3.5 border rounded-lg bg-gray-50 transition-colors duration-200 hover:bg-gray-100">
                          <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-white font-semibold">
                            {i + 1}
                          </span>
                              <span className="text-base flex items-center h-full">{q.text}</span>
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
  )
}
