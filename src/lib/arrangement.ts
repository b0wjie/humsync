import type { HumAnalysis, LayerRole, LoopLayer, LoopSettings, Note } from "@/types";
import { LAYER_ROLES, keyToPitchClass, normalizeNote, snapMidiToScale } from "./music";

export interface ArrangementResult {
  layers: LoopLayer[];
  notes: string;
}

const ROLE_INSTRUMENTS: Record<LayerRole, string> = {
  lead: "Clean Lead",
  bass: "Sub Bass",
  pad: "Wide Pad",
  pluck: "Clock Pluck",
  atmosphere: "Air Bed",
};

export function createInitialArrangement(analysis: HumAnalysis, settings: LoopSettings, aiNotes?: string): ArrangementResult {
  const root = keyToPitchClass(settings.key, analysis.detectedKey);
  const lead = makeLayer({
    role: "lead",
    name: "Hummed Lead",
    notes: analysis.cleanedNotes,
    description: "Cleaned and quantized from the original hum.",
    source: "hum",
  });

  const bass = makeLayer({
    role: "bass",
    name: "Root Bass",
    notes: createBassNotes(analysis.cleanedNotes, root, settings),
    description: "Deterministic root anchor derived from the hummed melody.",
    source: "generated",
  });

  const pad = makeLayer({
    role: "pad",
    name: "Scale Pad",
    notes: createPadNotes(root, settings),
    description: "Sustained harmonic bed snapped to the selected key and scale.",
    source: "generated",
  });

  const pluck = makeLayer({
    role: "pluck",
    name: "Pulse Pluck",
    notes: createPluckNotes(analysis.cleanedNotes, settings),
    description: "Rhythmic counter pattern built from stable melody tones.",
    source: "generated",
  });

  return {
    layers: [lead, bass, pad, pluck],
    notes: aiNotes || "Local arrangement generated from the cleaned melody. AI notes can refine style, density, and counter movement.",
  };
}

export function createEmptyProjectLayers(settings: LoopSettings): LoopLayer[] {
  const root = snapMidiToScale(60, settings.key, settings.scale);
  const notes = [0, 1, 2, 3].map((time, index) => normalizeNote({
    midi: root + [0, 2, 4, 7][index],
    time,
    durationBeats: 1,
  }));

  return [
    makeLayer({
      role: "lead",
      name: "Starter Lead",
      notes,
      description: "Starter motif. Replace it by recording a hum.",
      source: "generated",
    }),
  ];
}

function createBassNotes(melody: Note[], root: number, settings: LoopSettings): Note[] {
  const loopBeats = settings.bars * 4;
  const barStarts = Array.from({ length: settings.bars }, (_, index) => index * 4);

  return barStarts.map((time) => {
    const localNotes = melody.filter((note) => note.time >= time && note.time < time + 4);
    const anchor = localNotes[0]?.midi ?? root + 48;
    const midi = snapMidiToScale(((anchor % 12) + 36), settings.key, settings.scale);
    return normalizeNote({
      midi: Math.min(midi, 48),
      time: Math.min(time, loopBeats - 1),
      durationBeats: 2,
      velocity: 0.78,
    });
  });
}

function createPadNotes(root: number, settings: LoopSettings): Note[] {
  const loopBeats = settings.bars * 4;
  const chordOffsets = settings.scale === "Minor" ? [0, 3, 7] : [0, 4, 7];
  const notes: Note[] = [];

  for (let time = 0; time < loopBeats; time += 4) {
    for (const offset of chordOffsets) {
      notes.push(normalizeNote({
        midi: 60 + root + offset,
        time,
        durationBeats: 4,
        velocity: 0.42,
      }));
    }
  }

  return notes;
}

function createPluckNotes(melody: Note[], settings: LoopSettings): Note[] {
  const source = melody.length ? melody : createEmptyProjectLayers(settings)[0].notes;
  const loopBeats = settings.bars * 4;
  const notes: Note[] = [];

  for (let time = 0; time < loopBeats; time += 0.5) {
    const seed = source[Math.floor(time * 2) % source.length];
    notes.push(normalizeNote({
      midi: snapMidiToScale(seed.midi + 12, settings.key, settings.scale),
      time,
      durationBeats: 0.25,
      velocity: 0.48,
    }));
  }

  return notes;
}

function makeLayer(input: {
  role: LayerRole;
  name: string;
  notes: Note[];
  description: string;
  source: LoopLayer["source"];
}): LoopLayer {
  const role = LAYER_ROLES.find((item) => item.id === input.role);

  return {
    id: crypto.randomUUID(),
    name: input.name,
    role: input.role,
    instrument: ROLE_INSTRUMENTS[input.role],
    notes: input.notes,
    volume: input.role === "lead" ? 0.9 : 0.65,
    mute: false,
    solo: false,
    source: input.source,
    description: input.description,
    color: role?.color || "#22c55e",
  };
}
