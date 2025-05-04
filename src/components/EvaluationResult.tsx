import { CheckCircle2, XCircle } from 'lucide-react'

type EvaluationResult = {
  questionMatch: string
  score: number
  feedback: string
  pass: boolean
  confidence: number
}

type EvaluationResultProps = {
  result: EvaluationResult
}

export default function EvaluationResult({ result }: EvaluationResultProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Question Answered</h3>
          <p className="text-gray-600">{result.questionMatch}</p>
        </div>
        <div className="flex items-center gap-2">
          {result.pass ? (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          ) : (
            <XCircle className="w-6 h-6 text-red-500" />
          )}
          <span className="font-semibold">{result.pass ? 'Pass' : 'Fail'}</span>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Score</h3>
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${result.score}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">{result.score}/100</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Feedback</h3>
        <p className="text-gray-600 mt-2">{result.feedback}</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Confidence</h3>
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-green-600 h-2.5 rounded-full"
              style={{ width: `${result.confidence * 100}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {Math.round(result.confidence * 100)}% confidence
          </p>
        </div>
      </div>
    </div>
  )
} 