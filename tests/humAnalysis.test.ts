import assert from "node:assert/strict";
import { analyzeAudioSamples, detectPitch } from "../src/lib/humAnalysis";
import { exportMidi } from "../src/lib/exporters";
import type { LoopLayer, LoopSettings } from "../src/types";

const sampleRate = 44100;

function sine(frequency: number, seconds: number) {
  const samples = new Float32Array(Math.floor(sampleRate * seconds));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.5;
  }
  return samples;
}

const settings: LoopSettings = {
  bars: 8,
  bpm: 120,
  key: "C",
  scale: "Major",
  preset: "pop",
  targetRole: "lead",
};

const pitch = detectPitch(sine(440, 0.1).subarray(0, 2048), sampleRate);
assert.ok(pitch, "detects a stable sine wave");
assert.ok(Math.abs(pitch!.frequency - 440) < 8, `expected A4 near 440Hz, got ${pitch?.frequency}`);

const analysis = analyzeAudioSamples({
  samples: sine(261.63, 2),
  sampleRate,
  settings,
});

assert.equal(analysis.loopBeats, 32, "8 bars creates a 32 beat loop");
assert.ok(analysis.cleanedNotes.length > 0, "creates cleaned notes");
assert.ok(analysis.cleanedNotes.every((note) => note.time >= 0 && note.time < 32), "quantizes notes inside the loop");
assert.ok(analysis.confidence > 30, "reports usable confidence for a stable tone");

const sixteenBarAnalysis = analyzeAudioSamples({
  samples: sine(329.63, 2),
  sampleRate,
  settings: { ...settings, bars: 16 },
});

assert.equal(sixteenBarAnalysis.loopBeats, 64, "16 bars creates a 64 beat loop");

const layer: LoopLayer = {
  id: "lead",
  name: "Lead",
  role: "lead",
  instrument: "Synth",
  notes: analysis.cleanedNotes.slice(0, 4),
  volume: 0.8,
  mute: false,
  solo: false,
  source: "hum",
  description: "Test layer",
  color: "#22c55e",
};

const midi = exportMidi([layer], 120);
const header = Buffer.from(await midi.arrayBuffer()).subarray(0, 4).toString("ascii");
assert.equal(header, "MThd", "MIDI export starts with a valid header");

console.log("humAnalysis tests passed");
