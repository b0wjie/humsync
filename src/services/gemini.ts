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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return payload as T;
}

function audioDataToObjectUrl(audioBase64: string, mimeType: string) {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export async function generateText(prompt: string) {
  const result = await postJson<{ text: string }>("/api/generate-text", { prompt });
  return result.text;
}

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
  return postJson<StackAnalysis>("/api/analyze-layer", {
    audioBase64,
    mimeType,
    currentStack,
    selectedKey,
    selectedScale,
    selectedMood,
    selectedPreset,
    targetInstrument,
    targetRole,
  });
}

export async function generateFullTrack(prompt: string) {
  const result = await postJson<{ audioBase64: string | null; mimeType: string }>("/api/generate-full-track", { prompt });

  if (!result.audioBase64) return null;

  return audioDataToObjectUrl(result.audioBase64, result.mimeType);
}
