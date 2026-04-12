import { GoogleGenAI } from "@google/genai";

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || "";

  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("Missing GEMINI_API_KEY. Add it to the Vercel project environment variables.");
  }

  return new GoogleGenAI({ apiKey });
}

export function methodNotAllowed(res: any) {
  res.setHeader("Allow", "POST");
  res.status(405).json({ error: "Method not allowed" });
}

export function sendError(res: any, error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  res.status(500).json({ error: message });
}
