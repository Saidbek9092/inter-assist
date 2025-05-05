import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const SYSTEM_PROMPT = `You are an expert IT interviewer evaluating candidate responses. Your task is to:
1. First, extract all questions asked in the audio with high precision:
   - Pay special attention to WH-question words: "What", "How", "Why", "When", "Where", "Which", "Who"
   - Listen for question markers like "So,", "Next question", "Second question", "Let me ask you", "Tell me about", "Explain", "Describe"
   - Note the difference between "How" and "What" questions - they require different types of answers
   - Pay attention to the interviewer's tone and question structure
   - Extract the exact wording of each question
   - Preserve all specific technical terms and context in the question
   - DO NOT infer or assume questions that weren't explicitly asked
   - DO NOT make up questions based on the candidate's answers
   - DO NOT include questions that were not explicitly asked in the audio

2. Analyze the ENTIRE interview to extract up to 5 skills in each category for the Candidate Overview:
   A. Hard Skills (Technical Competencies) - UP TO 5 MOST RELEVANT:
      - Select the most relevant technical skills from the entire interview (maximum 5):
        * Programming languages and frameworks mentioned
        * Technical concepts explained
        * Tools and technologies discussed
        * Architecture and design patterns
        * Development methodologies
        * Database and system knowledge
        * Security practices
        * Performance optimization techniques
        * Testing and debugging approaches
        * Version control and CI/CD experience

   B. Soft Skills (Interpersonal and Professional) - UP TO 5 MOST RELEVANT:
      - Select the most relevant soft skills from the entire interview (maximum 5):
        * Communication clarity and effectiveness
        * Problem-solving approach
        * Team collaboration experience
        * Leadership and mentoring
        * Adaptability and learning ability
        * Time management and organization
        * Critical thinking and analysis
        * Creativity and innovation
        * Conflict resolution
        * Professional attitude

3. CRITICAL: For the Candidate Overview, you MUST:
   - Select up to 5 most relevant hard skills from the entire interview (can be fewer if fewer skills were demonstrated)
   - Select up to 5 most relevant soft skills from the entire interview (can be fewer if fewer skills were demonstrated)
   - Consider skills demonstrated across all answers
   - Look for implicit skills in how they structure their responses
   - Consider both direct mentions and demonstrated abilities
   - If a skill is only partially shown, note it with "Basic understanding of" or "Emerging skills in"

4. For each individual answer, evaluate based on:
   - Technical accuracy and depth
   - Practical application of knowledge
   - Clarity of explanation
   - Relevance to the question
   - Examples and real-world experience
   - Problem-solving approach
   - Communication effectiveness

5. Provide a comprehensive assessment that includes:
   - Overall score (0-100)
   - Pass/fail status (passing threshold: 75%)
   - Candidate Overview with up to 5 hard skills and up to 5 soft skills from the entire interview
   - Detailed feedback for each answer
   - Areas for improvement

Return the evaluation in this exact JSON format:
{
  "overallScore": number between 0-100,
  "passed": boolean,
  "candidateOverview": {
    "hardSkills": ["up to 5 specific technical skills demonstrated across the entire interview"],
    "softSkills": ["up to 5 specific soft skills demonstrated across the entire interview"]
  },
  "questionResults": [
    {
      "question": "The exact question text",
      "score": number between 0-100,
      "feedback": "Detailed feedback about the answer",
      "passed": boolean,
      "notInList": boolean
    }
  ]
}

IMPORTANT: For the Candidate Overview, you MUST provide:
1. Up to 5 hard skills from the entire interview (can be fewer if fewer skills were demonstrated)
2. Up to 5 soft skills from the entire interview (can be fewer if fewer skills were demonstrated)
3. If a skill is only partially demonstrated, use phrases like:
   - "Basic understanding of [skill]"
   - "Emerging skills in [skill]"
   - "Potential for [skill]"
   - "Shows aptitude for [skill]"
4. Never include skills that were not demonstrated
5. Always analyze both explicit and implicit skills shown across all responses
6. DO NOT combine similar skills - each skill must be distinct
7. DO NOT include variations of the same skill
8. DO NOT include skills that are not directly demonstrated in any response
9. DO NOT pad the list with generic skills - only include skills that were actually demonstrated

VALIDATION RULES:
1. The candidateOverview.hardSkills array MUST contain between 0-5 items
2. The candidateOverview.softSkills array MUST contain between 0-5 items
3. No duplicate skills within each category
4. Each skill must be specific and distinct
5. Skills must be directly related to the interview responses
6. Only include skills that were actually demonstrated`

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const questions = JSON.parse(formData.get('questions') as string)

    // Log the questions received by the API
    console.log('Questions received by API:', questions)

    if (!audioFile || !questions) {
      return NextResponse.json(
        { error: 'Audio file and questions are required' },
        { status: 400 }
      )
    }

    // Log the formatted questions that will be sent to the model
    const formattedQuestions = questions.map((q: { text: string }, i: number) => `${i + 1}. ${q.text}`).join('\n')
    console.log('Formatted questions being sent to model:\n', formattedQuestions)

    // Transcribe the audio using OpenAI's Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    })

    // Log the transcription
    console.log('Transcription:', transcription.text)

    // Analyze the transcribed text using GPT-4
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `First, extract all questions asked in the audio. Then compare them with the provided list of generated questions. For each answer, use the exact question from the generated list that matches the audio question.

IMPORTANT: 
1. DO NOT make up questions that weren't asked
2. DO NOT match questions that are completely different
3. A question must match ALL technical terms to be considered a match
4. If a question is not in the list, mark it as "notInList": true

Example of correct matching:
- Audio: "What is your experience with serverless functions in the React project?"
  Matches: "What is your experience with serverless functions in a React project?"

Example of incorrect matching:
- Audio: "What is your experience with serverless functions in the React project?"
  Does NOT match: "What is your experience with React?"
  Does NOT match: "What is your experience with functions?"
  Does NOT match: "What is your experience with backend development?"

Generated Questions:
${formattedQuestions}

Audio Transcript:
${transcription.text}

Return the evaluation in the specified JSON format. For each answer, provide specific feedback about:
1. The exact question from the generated list that matches the audio question
2. Whether this question was in the generated list
3. What was good in the answer (examples, technical details, etc.)
4. What was missing (specific examples, technical depth, etc.)
5. How the answer could be improved
6. Whether the answer was too general or vague
7. Whether the answer meets the 75% passing threshold`
        }
      ],
      model: "gpt-4-turbo-preview",
      response_format: { type: "json_object" },
      temperature: 0.7,
      tool_choice: {
        type: "function",
        function: {
          name: "analyze_interview"
        }
      },
      tools: [{
        type: "function",
        function: {
          name: "analyze_interview",
          description: "Analyze the interview transcript and match questions with the provided list",
          parameters: {
            type: "object",
            properties: {
              overallScore: {
                type: "number",
                description: "Overall score between 0-100"
              },
              passed: {
                type: "boolean",
                description: "Whether the candidate passed (score >= 75)"
              },
              questionResults: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: {
                      type: "string",
                      description: "The exact question text from the generated list that matches the audio question"
                    },
                    score: {
                      type: "number",
                      description: "Score between 0-100"
                    },
                    feedback: {
                      type: "string",
                      description: "Detailed feedback about the answer"
                    },
                    passed: {
                      type: "boolean",
                      description: "Whether the answer passed (score >= 75)"
                    },
                    notInList: {
                      type: "boolean",
                      description: "Whether the question was not in the original list"
                    },
                    hardSkills: {
                      type: "array",
                      items: {
                        type: "string"
                      },
                      description: "List of EXACTLY 5 specific technical skills demonstrated",
                      minItems: 5,
                      maxItems: 5
                    },
                    softSkills: {
                      type: "array",
                      items: {
                        type: "string"
                      },
                      description: "List of EXACTLY 5 specific soft skills demonstrated",
                      minItems: 5,
                      maxItems: 5
                    }
                  },
                  required: ["question", "score", "feedback", "passed", "notInList", "hardSkills", "softSkills"]
                }
              }
            },
            required: ["overallScore", "passed", "questionResults"]
          }
        }
      }]
    })

    const response = completion.choices[0].message
    if (!response || !response.tool_calls || !response.tool_calls[0]) {
      throw new Error('No response from OpenAI')
    }

    const evaluation = JSON.parse(response.tool_calls[0].function.arguments)
    return NextResponse.json({
      transcription: transcription.text,
      analysis: evaluation
    })
  } catch (error) {
    console.error('Error analyzing audio:', error)
    return NextResponse.json(
      { 
        error: 'Failed to analyze audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 