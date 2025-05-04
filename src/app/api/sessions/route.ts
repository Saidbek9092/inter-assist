import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

type Session = {
  id: string;
  jobDescription: string;
  questions: Array<{ id: string; text: string }>;
  createdAt: number;
  role?: string;
  company?: string;
}

export async function GET() {
  try {
    console.log("Fetching sessions from MongoDB...");
    const client = await clientPromise;
    console.log("Connected to MongoDB client");
    
    const db = client.db();
    console.log("Connected to MongoDB database");
    
    // Only fetch sessions that have questions
    const sessions = await db.collection("sessions")
      .find({ "questions.0": { $exists: true } }) // Only sessions with at least one question
      .sort({ createdAt: -1 }) // Sort by newest first
      .toArray();
    
    // Validate and format dates
    const validatedSessions = sessions.map((session: Session) => {
      const date = new Date(session.createdAt);
      if (isNaN(date.getTime())) {
        console.warn("Invalid date found in session:", session.id, session.createdAt);
        // Set to current date if invalid
        session.createdAt = Date.now();
      }
      return session;
    });
    
    console.log(`Found ${validatedSessions.length} sessions with questions:`, 
      validatedSessions.map(s => ({
        id: s.id,
        timestamp: s.createdAt,
        date: new Date(s.createdAt).toISOString(),
        questionCount: s.questions.length
      }))
    );
    
    if (!Array.isArray(validatedSessions)) {
      console.error("Sessions is not an array:", validatedSessions);
      return NextResponse.json({ error: "Invalid sessions data format" }, { status: 500 });
    }
    
    return NextResponse.json(validatedSessions);
  } catch (error) {
    console.error("API SESSIONS GET ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    console.log("Creating new session...");
    const client = await clientPromise;
    const db = client.db();
    const body = await request.json() as Session;
    
    // Validate date
    const timestamp = Date.now();
    if (isNaN(body.createdAt) || body.createdAt <= 0) {
      console.warn("Invalid date provided, using current date");
      body.createdAt = timestamp;
    }
    
    console.log("Session data with validated date:", {
      id: body.id,
      timestamp: body.createdAt,
      date: new Date(body.createdAt).toISOString(),
      questionCount: body.questions?.length || 0
    });
    
    // Validate that the session has questions before saving
    if (!body.questions || body.questions.length === 0) {
      console.log("Skipping empty session");
      return NextResponse.json({ message: "Empty session not saved" });
    }
    
    const result = await db.collection("sessions").insertOne(body);
    console.log("Insert result:", {
      id: result.insertedId,
      timestamp: body.createdAt,
      date: new Date(body.createdAt).toISOString()
    });
    
    return NextResponse.json({ 
      insertedId: result.insertedId,
      ...body
    });
  } catch (error) {
    console.error("API SESSIONS POST ERROR:", error);
    return NextResponse.json({ error: "Failed to insert session" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      console.error("No session ID provided");
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const body = await request.json();
    console.log('Updating session:', { id, body });

    // First, check if the session exists
    const existingSession = await db.collection("sessions").findOne({ id: id });
    if (!existingSession) {
      console.error("Session not found:", id);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Update the session with all fields from the body
    const result = await db.collection("sessions").updateOne(
      { id: id },
      { 
        $set: {
          ...body,
          updatedAt: Date.now()
        }
      }
    );

    console.log('Update result:', result);

    if (result.matchedCount === 0) {
      console.error("No session matched for update:", id);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch and return the updated session
    const updatedSession = await db.collection("sessions").findOne({ id: id });
    console.log("Updated session:", updatedSession);
    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("API SESSIONS PUT ERROR:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      console.error("No session ID provided for deletion");
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    console.log("Deleting session with ID:", id);
    const client = await clientPromise;
    const db = client.db();
    
    const result = await db.collection("sessions").deleteOne({ id: id });
    
    if (result.deletedCount === 0) {
      console.error("No session found with ID:", id);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    
    console.log("Successfully deleted session:", id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API SESSIONS DELETE ERROR:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
} 