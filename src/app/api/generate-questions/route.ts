import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Validate API key
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set in environment variables')
} else {
  console.log('✅ OpenAI API key successfully loaded')
}

const openai = apiKey ? new OpenAI({
  apiKey: apiKey,
}) : null

const SYSTEM_PROMPT = `You are an expert IT interviewer. Your task is to analyze IT job descriptions and generate very short, simple, and clear interview questions. Each question should be a single sentence, ideally no more than 25 words. Avoid complex or multi-part questions. Focus on the most essential technical and soft skills for the role. Generate at least 50 questions that comprehensively cover all requirements and must-have skills from the job description.`

const USER_PROMPT = (url: string) => `Analyze the following IT job description URL and generate 50 concise, simple, and clear interview questions. Each question should be a single sentence, ideally no more than 25 words. Avoid complex or multi-part questions. Cover all requirements and must-have skills from the job description.\n\nURL: ${url}\n\nReturn the response in this exact JSON format:\n{\n  "questions": [\n    "question1",\n    "question2",\n    ... up to 50 questions ...\n    "question50"\n  ]\n}`

// Sample questions to return if API is not available
const SAMPLE_QUESTIONS = {
  "questions": [
    "What is React?",
    "How do you use Git?",
    "What is an API?",
    "Explain CSS Flexbox.",
    "What is a database?",
    "How do you debug code?",
    "What is cloud computing?",
    "Explain REST.",
    "What is unit testing?",
    "How do you handle deadlines?",
    "What is a pull request?",
    "How do you use Docker?",
    "What is continuous integration?",
    "Explain agile methodology.",
    "What is TypeScript?",
    "How do you manage state in React?",
    "What is a virtual machine?",
    "How do you secure a web app?",
    "What is a CDN?",
    "Explain HTTP status codes.",
    "What is OAuth?",
    "How do you write a test case?",
    "What is a microservice?",
    "How do you use npm?",
    "What is a branch in Git?",
    "How do you handle errors in code?",
    "What is a SQL query?",
    "How do you optimize website speed?",
    "What is a load balancer?",
    "How do you work in a team?",
    "What is a design pattern?",
    "How do you use GraphQL?",
    "What is a web server?",
    "How do you use environment variables?",
    "What is a session in web apps?",
    "How do you use Redux?",
    "What is a RESTful API?",
    "How do you use WebSockets?",
    "What is a service worker?",
    "How do you use SASS?",
    "What is a linter?",
    "How do you use Postman?",
    "What is a proxy server?",
    "How do you use SSH?",
    "What is a cron job?",
    "How do you use JWT?",
    "What is a middleware?",
    "How do you use ESLint?",
    "What is a monorepo?",
    "How do you use Kubernetes?",
    "What is a container?",
    "How do you use CI/CD pipelines?"
  ]
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // If API key is not available, return sample questions
    if (!openai) {
      console.warn('⚠️ OPENAI_API_KEY not set, returning sample questions')
      return NextResponse.json(SAMPLE_QUESTIONS)
    }

    console.log('🔄 Making request to OpenAI API...')
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: USER_PROMPT(url)
        }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    })

    console.log('✅ Successfully received response from OpenAI API')
    const response = completion.choices[0].message.content
    if (!response) {
      throw new Error('No response from OpenAI')
    }

    const questions = JSON.parse(response)
    console.log('📊 Generated questions:', questions.questions.length)
    
    // Validate the response structure
    if (!questions.questions || !Array.isArray(questions.questions) || questions.questions.length < 45) {
      throw new Error('Invalid question format or not enough questions generated')
    }

    console.log('✅ Successfully validated response structure')
    return NextResponse.json(questions)
  } catch (error) {
    console.error('❌ Error generating questions:', error)
    
    // If there's an error with OpenAI, return sample questions
    if (error instanceof Error && error.message.includes('OpenAI')) {
      console.warn('⚠️ OpenAI error, returning sample questions')
      return NextResponse.json(SAMPLE_QUESTIONS)
    }

    return NextResponse.json(
      { 
        error: 'Failed to generate questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 