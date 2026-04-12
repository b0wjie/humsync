import { Type } from "@google/genai";
import { getGeminiClient, methodNotAllowed, sendError } from "./_gemini.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    methodNotAllowed(res);
    return;
  }

  try {
    const {
      audioBase64,
      mimeType,
      currentStack,
      selectedKey,
      selectedScale,
      selectedMood,
      selectedPreset,
      targetInstrument,
      targetRole,
    } = req.body || {};

    if (!audioBase64 || !mimeType || !targetInstrument || !targetRole) {
      res.status(400).json({ error: "Missing required layer analysis data." });
      return;
    }

    const stackContext = (Array.isArray(currentStack) ? currentStack : []).map((layer: any) => ({
      role: layer.role,
      instrument: layer.instrument,
      zone: layer.frequencyZone,
      description: layer.geminiDescription,
    }));

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: audioBase64,
            mimeType,
          },
        },
        {
          text: `You are a music producer helping build a layered melody from scratch.

Project Settings:
- Key: ${selectedKey}
- Scale: ${selectedScale}
- Mood: ${selectedMood}
- Sound Preset: ${selectedPreset}
- Target Instrument: ${targetInstrument}
- Target Role: ${targetRole}

Current stack:
${JSON.stringify(stackContext, null, 2)}

The user just hummed a melody intended to be a ${targetInstrument} (${targetRole}).

Your job:
1. Transcribe the humming into MIDI notes that fit the project key and scale: ${selectedKey} ${selectedScale}.
2. Identify the ideal frequency zone for a ${targetInstrument} (Sub-bass | Bass | Low-mid | Mid | High-mid | High | Air).
3. Describe how this new layer fits with existing layers, the ${selectedMood} mood, and the ${selectedPreset} aesthetic.
4. List which frequency zones are still uncovered.
5. Suggest the ideal NEXT layer to add.
6. Rate overall spectrum coverage: X/7 zones filled.

Provide the output as a JSON object matching the following schema:
{
  "layerAnalysis": {
    "role": "${targetRole}",
    "instrument": "${targetInstrument}",
    "frequencyZone": "string",
    "description": "string",
    "spectrumCoverage": [number, number],
    "notes": [{ "pitch": "C4", "duration": "4n", "time": 0 }]
  },
  "spectrumMap": {
    "Sub-bass": boolean,
    "Bass": boolean,
    "Low-mid": boolean,
    "Mid": boolean,
    "High-mid": boolean,
    "High": boolean,
    "Air": boolean
  },
  "nextSuggestion": "string",
  "coverageScore": number,
  "detectedKey": "string (optional)"
}`,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            layerAnalysis: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING },
                instrument: { type: Type.STRING },
                frequencyZone: { type: Type.STRING },
                description: { type: Type.STRING },
                spectrumCoverage: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                notes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      pitch: { type: Type.STRING },
                      duration: { type: Type.STRING },
                      time: { type: Type.NUMBER },
                    },
                    required: ["pitch", "duration", "time"],
                  },
                },
              },
              required: ["role", "instrument", "frequencyZone", "description", "spectrumCoverage", "notes"],
            },
            spectrumMap: {
              type: Type.OBJECT,
              properties: {
                "Sub-bass": { type: Type.BOOLEAN },
                "Bass": { type: Type.BOOLEAN },
                "Low-mid": { type: Type.BOOLEAN },
                "Mid": { type: Type.BOOLEAN },
                "High-mid": { type: Type.BOOLEAN },
                "High": { type: Type.BOOLEAN },
                "Air": { type: Type.BOOLEAN },
              },
            },
            nextSuggestion: { type: Type.STRING },
            coverageScore: { type: Type.NUMBER },
            detectedKey: { type: Type.STRING },
          },
          required: ["layerAnalysis", "spectrumMap", "nextSuggestion", "coverageScore"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    res.status(200).json(JSON.parse(text));
  } catch (error) {
    sendError(res, error);
  }
}
