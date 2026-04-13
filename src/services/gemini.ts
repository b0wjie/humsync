import type { LoopLayer, LoopSettings, Note } from "@/types";
import { SOUND_PRESETS, MUSICAL_KEYS, MUSICAL_SCALES } from "@/lib/music";

export type { HumAnalysis, LoopLayer, LoopProject, LoopSettings, Note, ExportResult } from "@/types";
export type Layer = LoopLayer;

export { SOUND_PRESETS, MUSICAL_KEYS, MUSICAL_SCALES };

export const SPECTRUM_ZONES = [
  { name: "Sub-bass", range: [20, 60], color: "#38bdf8" },
  { name: "Bass", range: [60, 250], color: "#0ea5e9" },
  { name: "Low-mid", range: [250, 500], color: "#22c55e" },
  { name: "Mid", range: [500, 2000], color: "#eab308" },
  { name: "High-mid", range: [2000, 6000], color: "#f97316" },
  { name: "High", range: [6000, 12000], color: "#ef4444" },
  { name: "Air", range: [12000, 20000], color: "#a855f7" },
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

export async function arrangeLoop(input: {
  melodyNotes: Note[];
  bars: number;
  bpm: number;
  key: string;
  scale: string;
  preset: string;
  role: string;
  ideaText: string;
  existingLayers: LoopLayer[];
}) {
  return postJson<{ producerNotes: string; suggestedLayers: Array<{ role: string; instrument: string; description: string }> }>("/api/arrange-loop", input);
}

export async function analyzeAndAddLayer(
  audioBase64: string,
  mimeType: string,
  currentStack: LoopLayer[],
  selectedKey: string,
  selectedScale: string,
  selectedMood: string,
  selectedPreset: string,
  targetInstrument: string,
  targetRole: string
) {
  return postJson("/api/analyze-layer", {
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

export function buildLyriaPrompt(settings: LoopSettings, layers: LoopLayer[], ideaText: string) {
  const layerText = layers.map((layer) => `${layer.name} (${layer.role}, ${layer.instrument}): ${layer.description}`).join("\n");
  return `Create a polished ${settings.bars}-bar ${settings.preset} loop at ${settings.bpm} BPM in ${settings.key} ${settings.scale}.

User idea:
${ideaText || "No text idea supplied. Preserve the melodic identity from the supplied loop layers."}

Loop layers:
${layerText}

Keep the hummed lead recognizable. Make the output feel like a production-ready idea loop, not a finished full song.`;
}
