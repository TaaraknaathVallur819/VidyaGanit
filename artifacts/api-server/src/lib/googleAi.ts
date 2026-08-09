import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY must be set to use Gemini.");
}

/** Direct Google GenAI client authenticated with the server's Gemini API key. */
export const gemini = new GoogleGenAI({ apiKey });