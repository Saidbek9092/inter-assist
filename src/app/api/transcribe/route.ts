import { NextResponse } from "next/server";
import OpenAI from "openai";
import { promises as fs } from "fs";
import { createReadStream } from "fs";
import path from "path";
import os from "os";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Save the file to a temporary location
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `${Date.now()}-recording.wav`);
    const arrayBuffer = await audioFile.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer));

    try {
      // Transcribe using OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: createReadStream(tempFilePath) as any,
        model: "whisper-1",
        language: "en",
      });

      // Clean up the temp file
      await fs.unlink(tempFilePath);

      return NextResponse.json({ transcript: transcription.text });
    } catch (error) {
      // Clean up the temp file in case of error
      await fs.unlink(tempFilePath);
      throw error;
    }
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return NextResponse.json(
      { 
        error: "Failed to transcribe audio",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 