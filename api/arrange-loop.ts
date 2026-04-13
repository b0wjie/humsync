import { Type } from "@google/genai";
import { getGeminiClient, methodNotAllowed, sendError } from "./_gemini.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    methodNotAllowed(res);
    return;
  }

  try {
    const { melodyNotes, bars, bpm, key, scale, preset, role, ideaText, existingLayers } = req.body || {};

    if (!Array.isArray(melodyNotes) || melodyNotes.length === 0) {
      res.status(400).json({ error: "Cleaned melody notes are required." });
      return;
    }

    const ai = getGeminiClient();
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        text: `You are a producer's arrangement assistant for HumSync.

The app already extracted and quantized the user's hummed melody. Do not retranscribe the audio.

Goal: help turn the verified melody into a usable ${bars}-bar loop for creators/producers.

Settings:
- BPM: ${bpm}
- Key: ${key}
- Scale: ${scale}
- Preset: ${preset}
- Target role: ${role}
- Idea text: ${ideaText || "none"}

Melody notes:
${JSON.stringify(melodyNotes)}

Existing layers:
${JSON.stringify(existingLayers || [])}

Return concise producer guidance plus 2-4 suggested support layers. Keep advice practical and preserve the hummed lead identity.`,
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            producerNotes: { type: Type.STRING },
            suggestedLayers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING },
                  instrument: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["role", "instrument", "description"],
              },
            },
          },
          required: ["producerNotes", "suggestedLayers"],
        },
      },
    });

    const text = result.text;
    if (!text) throw new Error("No arrangement response from Gemini.");

    res.status(200).json(JSON.parse(text));
  } catch (error) {
    sendError(res, error);
  }
}
