import type { LoopLayer, Note } from "@/types";
import { midiToFrequency } from "./music";

const SAMPLE_RATE = 44100;

export async function renderLoopWav(layers: LoopLayer[], bpm: number, loopBeats: number) {
  const secondsPerBeat = 60 / bpm;
  const durationSeconds = loopBeats * secondsPerBeat;
  const length = Math.ceil(durationSeconds * SAMPLE_RATE);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const audible = getAudibleLayers(layers);

  for (const layer of audible) {
    for (const note of layer.notes) {
      renderNote(left, right, note, layer, bpm);
    }
  }

  normalize(left, right);
  return encodeWav(left, right, SAMPLE_RATE);
}

export function exportMidi(layers: LoopLayer[], bpm: number) {
  const ticksPerBeat = 480;
  const tracks: Uint8Array[] = [];

  tracks.push(makeTempoTrack(bpm));

  for (const layer of getAudibleLayers(layers)) {
    tracks.push(makeNoteTrack(layer, ticksPerBeat));
  }

  const header = concatBytes(
    ascii("MThd"),
    uint32(6),
    uint16(1),
    uint16(tracks.length),
    uint16(ticksPerBeat),
  );

  return new Blob([concatBytes(header, ...tracks)], { type: "audio/midi" });
}

function getAudibleLayers(layers: LoopLayer[]) {
  const soloed = layers.filter((layer) => layer.solo && !layer.mute);
  return soloed.length ? soloed : layers.filter((layer) => !layer.mute);
}

function renderNote(left: Float32Array, right: Float32Array, note: Note, layer: LoopLayer, bpm: number) {
  const secondsPerBeat = 60 / bpm;
  const start = Math.floor(note.time * secondsPerBeat * SAMPLE_RATE);
  const duration = Math.max(0.05, note.durationBeats * secondsPerBeat);
  const end = Math.min(left.length, start + Math.floor(duration * SAMPLE_RATE));
  const frequency = midiToFrequency(note.midi);
  const gain = (layer.volume * (note.velocity ?? 0.75)) / 4;
  const pan = layer.role === "pad" ? 0.25 : layer.role === "pluck" ? -0.2 : 0;

  for (let index = start; index < end; index++) {
    const t = (index - start) / SAMPLE_RATE;
    const env = envelope(t, duration, layer.role);
    const sample = oscillator(t, frequency, layer.role) * env * gain;
    left[index] += sample * (pan <= 0 ? 1 : 1 - pan);
    right[index] += sample * (pan >= 0 ? 1 : 1 + pan);
  }
}

function oscillator(time: number, frequency: number, role: LoopLayer["role"]) {
  const phase = 2 * Math.PI * frequency * time;
  if (role === "bass") return Math.sign(Math.sin(phase)) * 0.7 + Math.sin(phase) * 0.3;
  if (role === "pad" || role === "atmosphere") return Math.sin(phase) * 0.65 + Math.sin(phase * 0.5) * 0.35;
  if (role === "pluck") return Math.sin(phase) * 0.8 + Math.sin(phase * 2) * 0.2;
  return Math.sin(phase) * 0.65 + saw(phase) * 0.35;
}

function envelope(time: number, duration: number, role: LoopLayer["role"]) {
  const attack = role === "pad" || role === "atmosphere" ? 0.2 : 0.015;
  const release = role === "pad" || role === "atmosphere" ? 0.35 : 0.08;
  const fadeIn = Math.min(1, time / attack);
  const fadeOut = Math.min(1, (duration - time) / release);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

function saw(phase: number) {
  return 2 * (phase / (2 * Math.PI) - Math.floor(phase / (2 * Math.PI) + 0.5));
}

function normalize(left: Float32Array, right: Float32Array) {
  let peak = 0.001;
  for (let i = 0; i < left.length; i++) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const gain = Math.min(1, 0.92 / peak);
  for (let i = 0; i < left.length; i++) {
    left[i] *= gain;
    right[i] *= gain;
  }
}

function encodeWav(left: Float32Array, right: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const blockAlign = 4;
  const dataLength = left.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  let offset = 0;

  writeString(view, offset, "RIFF"); offset += 4;
  view.setUint32(offset, 36 + dataLength, true); offset += 4;
  writeString(view, offset, "WAVE"); offset += 4;
  writeString(view, offset, "fmt "); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, 2, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true); offset += 2;
  writeString(view, offset, "data"); offset += 4;
  view.setUint32(offset, dataLength, true); offset += 4;

  for (let i = 0; i < left.length; i++) {
    view.setInt16(offset, clamp16(left[i]), true); offset += 2;
    view.setInt16(offset, clamp16(right[i]), true); offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function clamp16(sample: number) {
  return Math.max(-1, Math.min(1, sample)) * 0x7fff;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function makeTempoTrack(bpm: number) {
  const microseconds = Math.round(60000000 / bpm);
  const events = concatBytes(
    uint8(0), uint8(0xff), uint8(0x51), uint8(0x03),
    uint8((microseconds >> 16) & 0xff),
    uint8((microseconds >> 8) & 0xff),
    uint8(microseconds & 0xff),
    uint8(0), uint8(0xff), uint8(0x2f), uint8(0),
  );
  return concatBytes(ascii("MTrk"), uint32(events.length), events);
}

function makeNoteTrack(layer: LoopLayer, ticksPerBeat: number) {
  const events: number[] = [];
  events.push(0, 0xff, 0x03, layer.name.length, ...ascii(layer.name));

  const noteEvents = layer.notes.flatMap((note) => [
    { tick: Math.round(note.time * ticksPerBeat), type: "on" as const, note },
    { tick: Math.round((note.time + note.durationBeats) * ticksPerBeat), type: "off" as const, note },
  ]).sort((a, b) => a.tick - b.tick || (a.type === "off" ? -1 : 1));

  let lastTick = 0;
  const channel = Math.min(15, Math.abs(hash(layer.id)) % 16);

  for (const event of noteEvents) {
    events.push(...varLen(event.tick - lastTick));
    lastTick = event.tick;
    if (event.type === "on") {
      events.push(0x90 | channel, event.note.midi, Math.round((event.note.velocity ?? 0.8) * 100));
    } else {
      events.push(0x80 | channel, event.note.midi, 0);
    }
  }

  events.push(0, 0xff, 0x2f, 0);
  const bytes = new Uint8Array(events);
  return concatBytes(ascii("MTrk"), uint32(bytes.length), bytes);
}

function varLen(value: number) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= ((value & 0x7f) | 0x80);
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function hash(value: string) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function ascii(value: string) {
  return new Uint8Array([...value].map((char) => char.charCodeAt(0)));
}

function uint8(value: number) {
  return new Uint8Array([value]);
}

function uint16(value: number) {
  return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
}

function uint32(value: number) {
  return new Uint8Array([(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]);
}

function concatBytes(...arrays: Uint8Array[]) {
  const output = new Uint8Array(arrays.reduce((sum, array) => sum + array.length, 0));
  let offset = 0;
  for (const array of arrays) {
    output.set(array, offset);
    offset += array.length;
  }
  return output;
}
