import { Modality } from "@google/genai";
import { getGeminiClient, methodNotAllowed, sendError } from "./_gemini";

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
    const response = await ai.models.generateContentStream({
      model: "lyria-3-clip-preview",
      contents: prompt,
      config: {
        responseModalities: [Modality.AUDIO],
      },
    });

    let audioBase64 = "";
    let mimeType = "audio/wav";

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;

      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }

          audioBase64 += part.inlineData.data;
        }
      }
    }

    res.status(200).json({
      audioBase64: audioBase64 || null,
      mimeType,
    });
  } catch (error) {
    sendError(res, error);
  }
}
