import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import * as cheerio from 'cheerio'

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

const SYSTEM_PROMPT = `You are an expert IT interviewer. Your task is to analyze the job description and generate specific, targeted interview questions. Follow these rules:
1. Extract key technical terms, tools, and requirements from the job description
2. Create questions that directly reference these specific terms
3. Focus on the exact technologies, frameworks, and tools mentioned
4. Include questions about specific years of experience mentioned
5. Reference specific responsibilities and requirements
6. Each question should be a single sentence, ideally no more than 25 words
7. Avoid generic questions that could apply to any job
8. Generate at least 50 questions that cover all specific requirements

Example of good specific questions:
- "How many years of experience do you have with [specific technology]?"
- "Can you describe your experience with [specific tool] mentioned in the requirements?"
- "How have you used [specific framework] in your previous projects?"
- "What is your approach to [specific responsibility] mentioned in the job description?"`

const USER_PROMPT = (jobDescription: string) => `Analyze the following job description and generate 50 specific interview questions. Each question should directly reference the technologies, tools, requirements, and responsibilities mentioned in the job description. Avoid generic questions.

Job Description:
${jobDescription}

First, identify these key elements from the job description:
1. Specific technologies and tools mentioned
2. Required years of experience
3. Specific responsibilities
4. Required skills and qualifications
5. Nice-to-have requirements

Then generate questions that directly reference these elements.

Return the response in this exact JSON format:
{
  "questions": [
    "question1",
    "question2",
    ... up to 50 questions ...
    "question50"
  ]
}`

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

// Function to fetch and parse HTML content
async function fetchJobDescription(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`)
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // Remove script and style elements
    $('script').remove()
    $('style').remove()
    
    // Common job-related keywords to look for
    const jobKeywords = [
      'responsibilities',
      'requirements',
      'qualifications',
      'job description',
      'about the role',
      'what you\'ll do',
      'what you will do',
      'key responsibilities',
      'required skills',
      'desired skills',
      'minimum qualifications',
      'preferred qualifications',
      'about the position',
      'role description',
      'position overview'
    ]

    // Function to check if text contains job-related content
    const isJobContent = (text: string): boolean => {
      const lowerText = text.toLowerCase()
      return jobKeywords.some(keyword => lowerText.includes(keyword)) &&
             text.length > 200 && // Minimum length to ensure it's actual content
             !text.includes('cookie') && // Exclude cookie notices
             !text.includes('privacy policy') // Exclude privacy policies
    }

    // Function to clean text content
    const cleanText = (text: string): string => {
      return text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim()
    }

    // Try to find the main content area first
    const mainContentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '#content',
      '.container',
      '.wrapper',
      'article',
      '.article'
    ]

    for (const selector of mainContentSelectors) {
      const content = cleanText($(selector).text())
      if (isJobContent(content)) {
        console.log(`✅ Found job description in main content area: ${selector}`)
        return content
      }
    }

    // Try common job description selectors
    const commonSelectors = [
      // Data attributes
      '[data-automation-id*="job"]',
      '[data-test*="job"]',
      '[data-cy*="job"]',
      // Common classes
      '[class*="job-description"]',
      '[class*="jobDetails"]',
      '[class*="description"]',
      '[class*="content"]',
      // Common IDs
      '[id*="job-description"]',
      '[id*="jobDetails"]',
      '[id*="description"]',
      // Schema.org
      '[itemprop="description"]',
      // Common elements
      '.job-description',
      '.job-details',
      '.description',
      '.content',
      '#jobDescription',
      '#jobDetails'
    ]

    for (const selector of commonSelectors) {
      const content = cleanText($(selector).text())
      if (isJobContent(content)) {
        console.log(`✅ Found job description using selector: ${selector}`)
        return content
      }
    }

    // If no specific selectors work, try to find any element with job-related content
    const allElements = $('div, section, article, main')
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i]
      const text = cleanText($(element).text())
      if (isJobContent(text)) {
        console.log('✅ Found job description in element content')
        return text
      }
    }

    // Last resort: Get all text content and try to find the most relevant section
    const bodyText = cleanText($('body').text())
    if (bodyText.length > 200) {
      // Split the text into paragraphs and find the one with most job-related keywords
      const paragraphs = bodyText.split(/\n\s*\n/)
      let bestParagraph = ''
      let maxKeywords = 0

      for (const paragraph of paragraphs) {
        const keywordCount = jobKeywords.filter(keyword => 
          paragraph.toLowerCase().includes(keyword)
        ).length

        if (keywordCount > maxKeywords && paragraph.length > 200) {
          maxKeywords = keywordCount
          bestParagraph = paragraph
        }
      }

      if (bestParagraph) {
        console.log('⚠️ Using best matching paragraph from body text')
        return bestParagraph
      }

      console.log('⚠️ Using fallback: extracted all body text')
      return bodyText
    }
    
    throw new Error('Could not find job description content')
  } catch (error) {
    console.error('Error fetching job description:', error)
    throw error
  }
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
      console.log('📋 Sample Questions:')
      SAMPLE_QUESTIONS.questions.forEach((q, i) => {
        console.log(`${i + 1}. ${q}`)
      })
      return NextResponse.json(SAMPLE_QUESTIONS)
    }

    console.log('🔄 Fetching job description from URL...')
    const jobDescription = await fetchJobDescription(url)
    console.log('✅ Successfully fetched job description')
    console.log('📝 Job Description Preview:', jobDescription.substring(0, 200) + '...')

    console.log('🔄 Making request to OpenAI API...')
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: USER_PROMPT(jobDescription)
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
    console.log('\n📋 Generated Questions:')
    questions.questions.forEach((q: string, i: number) => {
      console.log(`${i + 1}. ${q}`)
    })
    
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
      console.log('📋 Sample Questions:')
      SAMPLE_QUESTIONS.questions.forEach((q, i) => {
        console.log(`${i + 1}. ${q}`)
      })
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