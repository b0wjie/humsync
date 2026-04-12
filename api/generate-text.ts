import { getGeminiClient, methodNotAllowed, sendError } from "./_gemini.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    methodNotAllowed(res);
    return;
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "A prompt is required." });
      return;
    }

    const ai = getGeminiClient();
    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ text: prompt }],
    });

    res.status(200).json({ text: result.text });
  } catch (error) {
    sendError(res, error);
  }
}
