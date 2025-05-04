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

2. For each answer, analyze and extract:
   A. Hard Skills (Technical Competencies):
      - Programming languages and frameworks mentioned
      - Technical concepts explained
      - Tools and technologies discussed
      - Architecture and design patterns
      - Development methodologies
      - Database and system knowledge
      - Security practices
      - Performance optimization techniques
      - Testing and debugging approaches
      - Version control and CI/CD experience

   B. Soft Skills (Interpersonal and Professional):
      - Communication clarity and effectiveness
      - Problem-solving approach
      - Team collaboration experience
      - Leadership and mentoring
      - Adaptability and learning ability
      - Time management and organization
      - Critical thinking and analysis
      - Creativity and innovation
      - Conflict resolution
      - Professional attitude

3. CRITICAL: For each answer, you MUST:
   - Extract at least 2-3 specific hard skills demonstrated
   - Extract at least 2-3 specific soft skills demonstrated
   - Even if the answer is brief, analyze the underlying skills shown
   - Look for implicit skills in how they structure their response
   - Consider both direct mentions and demonstrated abilities
   - If a skill is only partially shown, note it with "Basic understanding of" or "Emerging skills in"

4. Evaluate each answer based on:
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
   - Detailed feedback for each answer
   - Specific hard skills demonstrated
   - Specific soft skills demonstrated
   - Areas for improvement

Return the evaluation in this exact JSON format:
{
  "overallScore": number between 0-100,
  "passed": boolean,
  "questionResults": [
    {
      "question": "The exact question text",
      "score": number between 0-100,
      "feedback": "Detailed feedback including specific hard and soft skills demonstrated",
      "passed": boolean,
      "notInList": boolean,
      "hardSkills": ["list of specific technical skills demonstrated"],
      "softSkills": ["list of specific soft skills demonstrated"]
    }
  ]
}

IMPORTANT: For each answer, you MUST provide:
1. At least 2-3 specific hard skills, even if they are basic or emerging
2. At least 2-3 specific soft skills, even if they are basic or emerging
3. If a skill is only partially demonstrated, use phrases like:
   - "Basic understanding of [skill]"
   - "Emerging skills in [skill]"
   - "Potential for [skill]"
   - "Shows aptitude for [skill]"
4. Never leave hardSkills or softSkills arrays empty
5. Always analyze both explicit and implicit skills shown in the response`

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
                    }
                  },
                  required: ["question", "score", "feedback", "passed", "notInList"]
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