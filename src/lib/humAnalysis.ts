import type { HumAnalysis, LoopSettings, Note, PitchFrame } from "@/types";
import { beatsToToneDuration, detectKeyFromNotes, frequencyToMidi, midiToNoteName, normalizeNote, snapMidiToScale } from "./music";

const FRAME_SIZE = 2048;
const HOP_SIZE = 512;
const MIN_FREQUENCY = 70;
const MAX_FREQUENCY = 1100;
const MIN_RMS = 0.015;

export interface AudioAnalysisInput {
  samples: Float32Array;
  sampleRate: number;
  settings: LoopSettings;
}

export async function analyzeHumBlob(blob: Blob, settings: LoopSettings): Promise<HumAnalysis> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  await audioContext.close();

  return analyzeAudioSamples({
    samples: mixToMono(audioBuffer),
    sampleRate: audioBuffer.sampleRate,
    settings,
  });
}

export function analyzeAudioSamples({ samples, sampleRate, settings }: AudioAnalysisInput): HumAnalysis {
  const loopBeats = settings.bars * 4;
  const rawFrames = extractPitchFrames(samples, sampleRate);
  const segmentedNotes = segmentPitchFrames(rawFrames, settings.bpm, loopBeats);
  const detectedKey = detectKeyFromNotes(segmentedNotes);
  const selectedKey = settings.key === "Auto" ? detectedKey : settings.key;
  const cleanedNotes = cleanNotes(segmentedNotes, settings.bpm, loopBeats, selectedKey, settings.scale);
  const confidence = computeConfidence(rawFrames, segmentedNotes, cleanedNotes);

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    rawFrames,
    segmentedNotes,
    cleanedNotes,
    confidence,
    detectedKey,
    detectedBpm: settings.bpm,
    loopBeats,
    fidelitySummary: summarizeFidelity(confidence, segmentedNotes.length, cleanedNotes.length),
  };
}

export function extractPitchFrames(samples: Float32Array, sampleRate: number): PitchFrame[] {
  const frames: PitchFrame[] = [];

  for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
    const frame = samples.subarray(start, start + FRAME_SIZE);
    const rms = getRms(frame);
    const pitch = rms < MIN_RMS ? null : detectPitch(frame, sampleRate);
    const frequency = pitch?.frequency ?? null;

    frames.push({
      time: start / sampleRate,
      frequency,
      midi: frequency ? frequencyToMidi(frequency) : null,
      clarity: pitch?.clarity ?? 0,
      rms,
    });
  }

  return frames;
}

export function detectPitch(frame: Float32Array, sampleRate: number): { frequency: number; clarity: number } | null {
  const minLag = Math.floor(sampleRate / MAX_FREQUENCY);
  const maxLag = Math.floor(sampleRate / MIN_FREQUENCY);
  const correlations: number[] = [];
  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    let energy = 0;

    for (let i = 0; i < frame.length - lag; i++) {
      correlation += frame[i] * frame[i + lag];
      energy += frame[i] * frame[i] + frame[i + lag] * frame[i + lag];
    }

    const normalized = energy > 0 ? (2 * correlation) / energy : 0;
    correlations[lag] = normalized;
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorrelation < 0.32) return null;

  for (let lag = minLag; lag <= maxLag; lag++) {
    const previous = correlations[lag - 1] ?? 0;
    const current = correlations[lag] ?? 0;
    const next = correlations[lag + 1] ?? 0;
    if (current >= bestCorrelation * 0.88 && current >= previous && current >= next) {
      bestLag = lag;
      bestCorrelation = current;
      break;
    }
  }

  return {
    frequency: sampleRate / bestLag,
    clarity: Math.min(1, Math.max(0, bestCorrelation)),
  };
}

export function segmentPitchFrames(frames: PitchFrame[], bpm: number, loopBeats: number): Note[] {
  const notes: Note[] = [];
  const secondsPerBeat = 60 / bpm;
  let active: { midi: number; start: number; end: number; values: number[] } | null = null;

  for (const frame of frames) {
    const midi = frame.midi;
    const isVoiced = midi !== null && frame.clarity > 0.35;

    if (!isVoiced) {
      if (active) {
        pushSegment(notes, active, secondsPerBeat, loopBeats);
        active = null;
      }
      continue;
    }

    if (!active) {
      active = { midi, start: frame.time, end: frame.time, values: [midi] };
      continue;
    }

    if (Math.abs(midi - active.midi) <= 1.5) {
      active.end = frame.time;
      active.values.push(midi);
      active.midi = median(active.values);
    } else {
      pushSegment(notes, active, secondsPerBeat, loopBeats);
      active = { midi, start: frame.time, end: frame.time, values: [midi] };
    }
  }

  if (active) pushSegment(notes, active, secondsPerBeat, loopBeats);

  return mergeShortSegments(notes);
}

export function cleanNotes(notes: Note[], bpm: number, loopBeats: number, key: string, scale: string): Note[] {
  if (notes.length === 0) {
    const rootMidi = snapMidiToScale(60, key, scale);
    return [
      normalizeNote({ midi: rootMidi, time: 0, durationBeats: 1 }),
      normalizeNote({ midi: rootMidi + 2, time: 1, durationBeats: 1 }),
      normalizeNote({ midi: rootMidi + 4, time: 2, durationBeats: 1 }),
      normalizeNote({ midi: rootMidi + 7, time: 3, durationBeats: 1 }),
    ];
  }

  const grid = 0.25;
  const cleaned = notes
    .map((note) => {
      const time = clampToGrid(note.time, grid, loopBeats - grid);
      const rawEnd = Math.min(loopBeats, note.time + note.durationBeats);
      const end = Math.max(time + grid, clampToGrid(rawEnd, grid, loopBeats));
      const midi = snapMidiToScale(note.midi, key, scale);
      return normalizeNote({
        midi,
        time,
        durationBeats: Math.max(grid, end - time),
        velocity: note.velocity,
      });
    })
    .filter((note) => note.time < loopBeats)
    .sort((a, b) => a.time - b.time);

  return removeOverlaps(cleaned, loopBeats);
}

function pushSegment(notes: Note[], segment: { midi: number; start: number; end: number; values: number[] }, secondsPerBeat: number, loopBeats: number) {
  const durationSeconds = Math.max(0.08, segment.end - segment.start);
  const time = Math.min(loopBeats - 0.25, segment.start / secondsPerBeat);
  const durationBeats = Math.max(0.25, durationSeconds / secondsPerBeat);
  const midi = Math.round(median(segment.values));

  if (durationBeats < 0.18) return;

  notes.push(normalizeNote({ midi, time, durationBeats }));
}

function mergeShortSegments(notes: Note[]) {
  if (notes.length < 2) return notes;

  const merged: Note[] = [];

  for (const note of notes) {
    const previous = merged[merged.length - 1];
    if (previous && Math.abs(previous.midi - note.midi) <= 1 && note.time - (previous.time + previous.durationBeats) < 0.2) {
      previous.durationBeats = note.time + note.durationBeats - previous.time;
      previous.duration = beatsToToneDuration(previous.durationBeats);
      continue;
    }
    merged.push({ ...note });
  }

  return merged;
}

function removeOverlaps(notes: Note[], loopBeats: number) {
  return notes.map((note, index) => {
    const next = notes[index + 1];
    const maxEnd = next ? next.time : loopBeats;
    const durationBeats = Math.max(0.25, Math.min(note.durationBeats, maxEnd - note.time));
    return {
      ...note,
      durationBeats,
      duration: beatsToToneDuration(durationBeats),
    };
  });
}

function computeConfidence(frames: PitchFrame[], segmentedNotes: Note[], cleanedNotes: Note[]) {
  const voiced = frames.filter((frame) => frame.frequency && frame.clarity > 0.35);
  const voicedRatio = frames.length ? voiced.length / frames.length : 0;
  const clarity = voiced.length ? voiced.reduce((sum, frame) => sum + frame.clarity, 0) / voiced.length : 0;
  const noteScore = Math.min(1, cleanedNotes.length / 8);
  const stabilityPenalty = segmentedNotes.length > 64 ? 0.75 : 1;
  return Math.round((voicedRatio * 0.35 + clarity * 0.45 + noteScore * 0.2) * stabilityPenalty * 100);
}

function summarizeFidelity(confidence: number, rawCount: number, cleanCount: number) {
  if (confidence >= 70) return `Strong capture: ${cleanCount} cleaned notes retained from ${rawCount} detected gestures.`;
  if (confidence >= 45) return `Usable capture: ${cleanCount} notes found. Tighten the melody with key/BPM controls if needed.`;
  return `Low-confidence capture: ${cleanCount} notes recovered. Try a clearer hum, less background noise, or slower tempo.`;
}

function mixToMono(audioBuffer: AudioBuffer) {
  const output = new Float32Array(audioBuffer.length);

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      output[i] += data[i] / audioBuffer.numberOfChannels;
    }
  }

  return output;
}

function getRms(frame: Float32Array) {
  let sum = 0;
  for (const sample of frame) sum += sample * sample;
  return Math.sqrt(sum / frame.length);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

function clampToGrid(value: number, grid: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value / grid) * grid));
}
