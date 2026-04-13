export type LoopBars = 8 | 16;
export type LoopSource = "hum" | "generated" | "ai";
export type ExportType = "wav" | "midi" | "lyria";
export type LayerRole = "lead" | "bass" | "pad" | "pluck" | "atmosphere";

export interface Note {
  pitch: string;
  midi: number;
  duration: string;
  time: number;
  durationBeats: number;
  velocity?: number;
}

export interface PitchFrame {
  time: number;
  frequency: number | null;
  midi: number | null;
  clarity: number;
  rms: number;
}

export interface HumAnalysis {
  id: string;
  createdAt: string;
  rawFrames: PitchFrame[];
  segmentedNotes: Note[];
  cleanedNotes: Note[];
  confidence: number;
  detectedKey: string;
  detectedBpm: number;
  loopBeats: number;
  fidelitySummary: string;
}

export interface LoopSettings {
  bars: LoopBars;
  bpm: number;
  key: string;
  scale: string;
  preset: string;
  targetRole: LayerRole;
}

export interface LoopLayer {
  id: string;
  name: string;
  role: LayerRole;
  instrument: string;
  notes: Note[];
  volume: number;
  mute: boolean;
  solo: boolean;
  source: LoopSource;
  description: string;
  color: string;
}

export interface ExportResult {
  id: string;
  type: ExportType;
  name: string;
  url: string;
  createdAt: string;
}

export interface LoopProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  settings: LoopSettings;
  ideaText: string;
  recordingDataUrl?: string;
  analysis?: HumAnalysis;
  layers: LoopLayer[];
  exports: ExportResult[];
  aiNotes?: string;
}
