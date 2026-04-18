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
  // Hip Hop
  { id: "boom-bap", name: "Boom Bap", desc: "Old school golden era, dusty drums and vinyl warmth", category: "Hip-Hop" },
  { id: "trap", name: "Trap", desc: "Aggressive 808s, rapid hi-hats, and dark atmosphere", category: "Hip-Hop" },
  { id: "detroit", name: "Detroit Tech", desc: "Industrial, gritty, and hypnotic motor city vibes", category: "Hip-Hop" },
  
  // Electronic
  { id: "hard-techno", name: "Hard Techno", desc: "Agressive 150+ BPM, pounding kicks, and dark acid leads", category: "Electronic" },
  { id: "dnb", name: "Drum & Bass", desc: "High BPM, complex breakbeats, and deep sub-bass", category: "Electronic" },
  { id: "synthwave", name: "Synthwave", desc: "80s neon, retro-futuristic analog heat", category: "Electronic" },
  
  // Cinematic & Ambient
  { id: "cinematic", name: "Cinematic", desc: "Epic, orchestral, and atmospheric scoring", category: "Atmospheric" },
  { id: "ambient", name: "Ambient", desc: "Ethereal, spacious, and meditative", category: "Atmospheric" },
  
  // Experimental
  { id: "dark-drill", name: "Dark Drill", desc: "Minor chords, sliding bass, and tense rhythm", category: "Aggressive" },
  { id: "lofi", name: "Lo-Fi", desc: "Chill, bits-reduced, and nostalgic", category: "Chill" }
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
        text: `You are a professional music producer and MIDI transcription expert.
        
        Project Context:
        - Key: ${selectedKey}
        - Scale: ${selectedScale}
        - Mood: ${selectedMood}
        - Genre/Aesthetic: ${selectedPreset}
        - Target Instrument: ${targetInstrument}
        - Target Role: ${targetRole}
        
        Transcription Constraints:
        1. STRUCTURE: Force the melody into a coherent 4, 8, or 16 bar loop. The "notes" array MUST cover the entire duration of the loop. If the loop is 4 bars, the notes should reach up to time 16 (assuming 4 beats per bar, 16n steps). 
        2. QUANTIZATION: Quantize the performance strictly to the grid (1/16 notes).
        3. MUSICALITY: Ensure the notes strictly follow ${selectedKey} ${selectedScale}. 
        4. VARIATION: If the hummed input is short, expand/repeat it intelligently to ensure a full, professionally structured loop. Do not leave large empty gaps at the end of the 4/8/16 bar block.
        5. RHYTHMIC ANCHOR: For foundation/bass roles, prioritize a strong "one" (downbeat).
        
        Current stack:
        ${JSON.stringify(stackContext, null, 2)}
        
        Provide the output as a JSON object matching the following schema:
        {
          "layerAnalysis": {
            "role": "${targetRole}",
            "instrument": "${targetInstrument}",
            "frequencyZone": "Sub-bass | Bass | Low-mid | Mid | High-mid | High | Air",
            "description": "Short producer-style description",
            "spectrumCoverage": [minHz, maxHz],
            "notes": [{ "pitch": "C4", "duration": "4n", "time": 0, "velocity": 0.8 }]
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
          "nextSuggestion": "What should the producer add next?",
          "coverageScore": number,
          "detectedKey": "string"
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
                    velocity: { type: Type.NUMBER }
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
