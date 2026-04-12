import { GoogleGenAI, Type, Modality } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateText(prompt: string) {
  const result = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [{ text: prompt }]
  });
  return result.text;
}

export interface Note {
  pitch: string;
  duration: string;
  time: number;
}

export interface Layer {
  id: string;
  role: string;
  instrument: string;
  frequencyZone: string;
  audioUrl: string;
  geminiDescription: string;
  spectrumCoverage: [number, number];
  notes?: Note[];
}

export interface StackAnalysis {
  layerAnalysis: {
    role: string;
    instrument: string;
    frequencyZone: string;
    description: string;
    spectrumCoverage: [number, number];
    notes: Note[];
  };
  spectrumMap: {
    [zone: string]: boolean;
  };
  nextSuggestion: string;
  coverageScore: number;
  detectedKey?: string;
}

export const SPECTRUM_ZONES = [
  { name: "Sub-bass", range: [20, 60], color: "#4c1d95" },
  { name: "Bass", range: [60, 250], color: "#1e40af" },
  { name: "Low-mid", range: [250, 500], color: "#1e3a8a" },
  { name: "Mid", range: [500, 2000], color: "#1d4ed8" },
  { name: "High-mid", range: [2000, 6000], color: "#2563eb" },
  { name: "High", range: [6000, 12000], color: "#3b82f6" },
  { name: "Air", range: [12000, 20000], color: "#60a5fa" },
];

export const MUSICAL_KEYS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
];

export const MUSICAL_SCALES = [
  "Major", "Minor", "Pentatonic", "Dorian", "Phrygian", "Lydian", "Mixolydian"
];

export const MUSICAL_MOODS = [
  "Melancholic", "Euphoric", "Tense", "Peaceful", "Aggressive", "Dreamy", "Nostalgic", "Cinematic"
];

export const SOUND_PRESETS = [
  { id: "cinematic", name: "Cinematic", desc: "Epic, orchestral, and atmospheric" },
  { id: "lofi", name: "Lo-Fi", desc: "Chill, dusty, and nostalgic" },
  { id: "cyberpunk", name: "Cyberpunk", desc: "Aggressive, neon, and electronic" },
  { id: "acoustic", name: "Acoustic", desc: "Natural, warm, and organic" },
  { id: "techno", name: "Techno", desc: "Driving, repetitive, and industrial" },
  { id: "synthwave", name: "Synthwave", desc: "80s neon, retro-futuristic" },
  { id: "ambient", name: "Ambient", desc: "Ethereal, spacious, and calm" },
  { id: "jazz", name: "Jazz", desc: "Smooth, complex, and sophisticated" },
  { id: "trap", name: "Trap", desc: "Dark, bass-heavy, and rhythmic" },
  { id: "metal", name: "Metal", desc: "Heavy, distorted, and powerful" }
];

export async function analyzeAndAddLayer(
  audioBase64: string, 
  mimeType: string, 
  currentStack: Layer[],
  selectedKey: string,
  selectedScale: string,
  selectedMood: string,
  selectedPreset: string,
  targetInstrument: string,
  targetRole: string
): Promise<StackAnalysis> {
  const stackContext = currentStack.map(l => ({
    role: l.role,
    instrument: l.instrument,
    zone: l.frequencyZone,
    description: l.geminiDescription
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          data: audioBase64,
          mimeType: mimeType,
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

  try {
    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw error;
  }
}

export async function generateFullTrack(prompt: string) {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key is missing. Please select a paid API key.");
  }

  const lyriaAi = new GoogleGenAI({ apiKey });
  
  try {
    const response = await lyriaAi.models.generateContentStream({
      model: "lyria-3-clip-preview",
      contents: prompt,
      config: {
        responseModalities: [Modality.AUDIO],
      }
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

    if (!audioBase64) return null;

    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (error: any) {
    console.error("Lyria API Error:", error);
    throw error;
  }
}
