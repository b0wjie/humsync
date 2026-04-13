import type { LayerRole, LoopLayer, Note } from "@/types";

export const MUSICAL_KEYS = ["Auto", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const MUSICAL_SCALES = ["Major", "Minor", "Pentatonic", "Dorian", "Phrygian", "Lydian", "Mixolydian"];
export const LOOP_BARS = [8, 16] as const;

export const SOUND_PRESETS = [
  { id: "trap", name: "Trap", desc: "Dark low end, clipped hats, sparse hooks" },
  { id: "techno", name: "Techno", desc: "Driving pulse, repeating motifs, firm bass" },
  { id: "synthwave", name: "Synthwave", desc: "Retro leads, wide pads, neon motion" },
  { id: "ambient", name: "Ambient", desc: "Slow bloom, air, texture, soft movement" },
  { id: "pop", name: "Pop", desc: "Clear hook, simple harmony, polished lift" },
  { id: "lofi", name: "Lo-Fi", desc: "Dusty chords, warm wobble, relaxed swing" },
  { id: "cinematic", name: "Cinematic", desc: "Wide dynamics, emotional arc, deep space" },
  { id: "metal", name: "Metal", desc: "Heavy contour, tight rhythm, aggressive tone" },
];

export const LAYER_ROLES: Array<{ id: LayerRole; name: string; desc: string; color: string }> = [
  { id: "lead", name: "Lead", desc: "Main hummed melody", color: "#22c55e" },
  { id: "bass", name: "Bass", desc: "Root movement and low-end anchor", color: "#38bdf8" },
  { id: "pad", name: "Pad", desc: "Sustained harmony bed", color: "#f59e0b" },
  { id: "pluck", name: "Pluck", desc: "Arp or rhythmic counter pattern", color: "#ef4444" },
  { id: "atmosphere", name: "Atmosphere", desc: "Texture and space", color: "#a855f7" },
];

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SCALE_INTERVALS: Record<string, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Pentatonic: [0, 2, 4, 7, 9],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

export function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function frequencyToMidi(frequency: number) {
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

export function midiToNoteName(midi: number) {
  const rounded = Math.max(0, Math.round(midi));
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[rounded % 12]}${octave}`;
}

export function noteNameToMidi(note: string) {
  const match = note.match(/^([A-G]#?)(-?\d)$/);
  if (!match) return 60;
  return NOTE_NAMES.indexOf(match[1]) + (Number(match[2]) + 1) * 12;
}

export function beatsToToneDuration(beats: number) {
  if (beats >= 4) return "1m";
  if (beats >= 2) return "2n";
  if (beats >= 1) return "4n";
  if (beats >= 0.5) return "8n";
  return "16n";
}

export function keyToPitchClass(key: string, fallback = "C") {
  const normalized = key === "Auto" ? fallback : key;
  return Math.max(0, NOTE_NAMES.indexOf(normalized));
}

export function snapMidiToScale(midi: number, key: string, scale: string, fallbackKey = "C") {
  const root = keyToPitchClass(key, fallbackKey);
  const allowed = SCALE_INTERVALS[scale] || SCALE_INTERVALS.Major;
  let best = Math.round(midi);
  let bestDistance = Infinity;

  for (let candidate = Math.round(midi) - 12; candidate <= Math.round(midi) + 12; candidate++) {
    const interval = (candidate - root + 120) % 12;
    if (!allowed.includes(interval)) continue;
    const distance = Math.abs(candidate - midi);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

export function detectKeyFromNotes(notes: Note[]) {
  if (notes.length === 0) return "C";

  const histogram = new Array(12).fill(0);
  for (const note of notes) {
    histogram[note.midi % 12] += note.durationBeats || 1;
  }

  const max = histogram.indexOf(Math.max(...histogram));
  return NOTE_NAMES[max] || "C";
}

export function normalizeNote(note: Partial<Note> & { midi: number; time: number; durationBeats: number }): Note {
  const midi = Math.max(24, Math.min(96, Math.round(note.midi)));
  const durationBeats = Math.max(0.25, note.durationBeats);

  return {
    midi,
    pitch: midiToNoteName(midi),
    time: Math.max(0, note.time),
    durationBeats,
    duration: beatsToToneDuration(durationBeats),
    velocity: note.velocity ?? 0.85,
  };
}

export function cloneLayer(layer: LoopLayer): LoopLayer {
  return {
    ...layer,
    notes: layer.notes.map((note) => ({ ...note })),
  };
}
