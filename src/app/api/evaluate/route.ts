import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const SYSTEM_PROMPT = `You are an expert IT interviewer evaluating candidate responses. Your task is to:
1. Check if the answer matches any of the provided questions
2. Evaluate the quality of the answer
3. Determine if the candidate passes or fails based on their response

For each answer, provide:
- Question match (which question it answers)
- Score (0-100)
- Detailed feedback
- Pass/Fail recommendation

Be strict but fair in your evaluation. Consider:
- Technical accuracy
- Clarity of explanation
- Depth of knowledge
- Practical application
- Communication skills`

export async function POST(request: Request) {
  try {
    const { transcript, questions } = await request.json()

    if (!transcript || !questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Transcript and questions array are required' },
        { status: 400 }
      )
    }

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `Evaluate this candidate's answer against these questions:

Questions:
${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

Candidate's Answer:
${transcript}

Return the evaluation in this exact JSON format:
{
  "questionMatch": "The question this answer matches",
  "score": number between 0-100,
  "feedback": "Detailed feedback about the answer",
  "pass": boolean,
  "confidence": number between 0-1
}`
        }
      ],
      model: "gpt-4-turbo-preview",
      response_format: { type: "json_object" },
      temperature: 0.7
    })

    const response = completion.choices[0].message.content
    if (!response) {
      throw new Error('No response from OpenAI')
    }

    const evaluation = JSON.parse(response)
    return NextResponse.json(evaluation)
  } catch (error) {
    console.error('Error evaluating answer:', error)
    return NextResponse.json(
      { 
        error: 'Failed to evaluate answer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 