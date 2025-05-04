import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI as string;
const options = {};

let client;
let clientPromise: Promise<MongoClient>;

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set in environment variables");
  throw new Error("Please add your Mongo URI to .env.local");
}

console.log("MongoDB URI:", uri);

if (process.env.NODE_ENV === "development") {
  if (!(global as any)._mongoClientPromise) {
    console.log("Creating new MongoDB client in development mode");
    client = new MongoClient(uri, options);
    (global as any)._mongoClientPromise = client.connect();
  }
  clientPromise = (global as any)._mongoClientPromise;
} else {
  console.log("Creating new MongoDB client in production mode");
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Add error handling for the connection
clientPromise.catch((error) => {
  console.error("Failed to connect to MongoDB:", error);
});

export default clientPromise; 