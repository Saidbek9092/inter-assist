import { useState, useRef } from 'react'
import { AudioRecorder } from '@/lib/audioRecorder'

type EvaluationResult = {
  questionMatch: string
  score: number
  feedback: string
  pass: boolean
  confidence: number
}

type EvaluationProps = {
  question: string
  onEvaluationComplete: (result: EvaluationResult) => void
}

export default function Evaluation({ question, onEvaluationComplete }: EvaluationProps) {
  const [error, setError] = useState<string | null>(null)
  const audioRecorder = useRef<AudioRecorder | null>(null)

  const handleStartRecording = async () => {
    try {
      audioRecorder.current = new AudioRecorder()
      const success = await audioRecorder.current.startRecording()
      if (!success) {
        setError('Failed to start recording')
      }
    } catch {
      setError('Failed to access microphone')
    }
  }

  const handleStopRecording = async () => {
    if (!audioRecorder.current) return

    try {
      const audioBlob = await audioRecorder.current.stopRecording()
      
      if (!audioBlob) {
        setError('Failed to get recording')
        return
      }

      // Upload audio and get transcript
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to transcribe audio')
      }

      const { transcript } = await response.json()
      
      // Evaluate the transcript
      await handleEvaluate(transcript)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to process recording')
    }
  }

  const handleEvaluate = async (transcript: string) => {
    setError(null)

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          questions: [question],
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to evaluate answer')
      }

      const result = await response.json()
      onEvaluationComplete(result)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to evaluate answer')
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  )
} 