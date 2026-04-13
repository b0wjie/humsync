import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import { motion } from "motion/react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  Download,
  FileAudio,
  FileMusic,
  Layers,
  Loader2,
  Mic,
  Music,
  Play,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  Square,
  Wand2,
  X,
} from "lucide-react";
import { AudioRecorder } from "./components/AudioRecorder";
import { arrangeLoop, buildLyriaPrompt, generateFullTrack } from "./services/gemini";
import type { ExportResult, HumAnalysis, LoopLayer, LoopProject, LoopSettings } from "./types";
import { createEmptyProjectLayers, createInitialArrangement } from "./lib/arrangement";
import { analyzeHumBlob } from "./lib/humAnalysis";
import { blobToDataUrl } from "./lib/blob";
import { clearCurrentProject, loadCurrentProject, saveProject } from "./lib/projectStorage";
import { exportMidi, renderLoopWav } from "./lib/exporters";
import { LAYER_ROLES, LOOP_BARS, MUSICAL_KEYS, MUSICAL_SCALES, SOUND_PRESETS, midiToFrequency } from "./lib/music";
import { cn } from "./lib/utils";

const STAGES = [
  { id: "capture", label: "Capture", icon: Mic },
  { id: "clean", label: "Clean", icon: Sliders },
  { id: "arrange", label: "Arrange", icon: Layers },
  { id: "export", label: "Export", icon: Download },
] as const;

type StageId = typeof STAGES[number]["id"];

const DEFAULT_SETTINGS: LoopSettings = {
  bars: 8,
  bpm: 120,
  key: "Auto",
  scale: "Minor",
  preset: "trap",
  targetRole: "lead",
};

function createProject(): LoopProject {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Untitled HumSync Loop",
    createdAt: now,
    updatedAt: now,
    settings: DEFAULT_SETTINGS,
    ideaText: "",
    layers: [],
    exports: [],
  };
}

export default function App() {
  const [project, setProject] = useState<LoopProject>(() => createProject());
  const [stage, setStage] = useState<StageId>("capture");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isArranging, setIsArranging] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState("Ready to catch the idea.");
  const [error, setError] = useState<string | null>(null);
  const synthsRef = useRef<Tone.PolySynth[]>([]);

  const loopBeats = project.settings.bars * 4;
  const activeLayers = useMemo(() => {
    const soloed = project.layers.filter((layer) => layer.solo && !layer.mute);
    return soloed.length ? soloed : project.layers.filter((layer) => !layer.mute);
  }, [project.layers]);

  useEffect(() => {
    loadCurrentProject()
      .then((saved) => {
        if (saved) {
          setProject(saved);
          setStatus("Restored your last local HumSync project.");
        }
      })
      .catch(() => setStatus("Local project restore unavailable. Starting clean."))
      .finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const handle = window.setTimeout(() => {
      saveProject({ ...project, updatedAt: new Date().toISOString() }).catch(() => {
        setStatus("Local save failed. Exports still work in this session.");
      });
    }, 500);

    return () => window.clearTimeout(handle);
  }, [project, isLoaded]);

  useEffect(() => {
    return () => stopPlayback();
  }, []);

  const updateSettings = (patch: Partial<LoopSettings>) => {
    setProject((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleRecordingComplete = async (blob: Blob) => {
    setIsAnalyzing(true);
    setError(null);
    setStatus("Listening for pitch contour, rhythm, rests, and note starts...");

    try {
      const [analysis, recordingDataUrl] = await Promise.all([
        analyzeHumBlob(blob, project.settings),
        blobToDataUrl(blob),
      ]);

      setProject((current) => ({
        ...current,
        recordingDataUrl,
        analysis,
        settings: {
          ...current.settings,
          key: current.settings.key === "Auto" ? analysis.detectedKey : current.settings.key,
        },
        layers: [],
        exports: [],
        updatedAt: new Date().toISOString(),
      }));
      setStage("clean");
      setStatus("Hum captured. Compare the raw extraction with the cleaned loop.");
    } catch (caught) {
      console.error(caught);
      setError("Could not analyze that recording. Check microphone permission, reduce room noise, and hum one clear phrase.");
      setStatus("Capture failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeError = (message: string) => {
    setError(message);
    setStatus("Microphone is blocked or unavailable.");
  };

  const handleArrange = async () => {
    if (!project.analysis) return;

    setIsArranging(true);
    setError(null);
    setStatus("Building a reliable local loop first, then asking Gemini for producer guidance...");

    try {
      let producerNotes = "";
      try {
        const ai = await arrangeLoop({
          melodyNotes: project.analysis.cleanedNotes,
          bars: project.settings.bars,
          bpm: project.settings.bpm,
          key: project.settings.key,
          scale: project.settings.scale,
          preset: project.settings.preset,
          role: project.settings.targetRole,
          ideaText: project.ideaText,
          existingLayers: project.layers,
        });
        producerNotes = ai.producerNotes;
      } catch (aiError) {
        console.warn("AI arrangement unavailable:", aiError);
        producerNotes = "AI arrangement unavailable. HumSync kept the loop usable with deterministic local lead, bass, pad, and pluck layers.";
      }

      const arrangement = createInitialArrangement(project.analysis, project.settings, producerNotes);
      setProject((current) => ({
        ...current,
        layers: arrangement.layers,
        aiNotes: arrangement.notes,
        updatedAt: new Date().toISOString(),
      }));
      setStage("arrange");
      setStatus("Arrangement ready. The local synth loop is now the source of truth.");
    } finally {
      setIsArranging(false);
    }
  };

  const handleStarterLoop = () => {
    setProject((current) => ({
      ...current,
      layers: createEmptyProjectLayers(current.settings),
      aiNotes: "Starter loop loaded. Record a hum to replace it with your own idea.",
      updatedAt: new Date().toISOString(),
    }));
    setStage("arrange");
  };

  const toggleLayer = (id: string, field: "mute" | "solo") => {
    setProject((current) => ({
      ...current,
      layers: current.layers.map((layer) => layer.id === id ? { ...layer, [field]: !layer[field] } : layer),
      updatedAt: new Date().toISOString(),
    }));
  };

  const setLayerVolume = (id: string, volume: number) => {
    setProject((current) => ({
      ...current,
      layers: current.layers.map((layer) => layer.id === id ? { ...layer, volume } : layer),
      updatedAt: new Date().toISOString(),
    }));
  };

  const playLoop = async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (activeLayers.length === 0) {
      setError("Add or generate at least one loop layer before playback.");
      return;
    }

    await Tone.start();
    stopPlayback();
    Tone.getTransport().bpm.value = project.settings.bpm;
    Tone.getTransport().loop = true;
    Tone.getTransport().loopStart = 0;
    Tone.getTransport().loopEnd = loopBeats * (60 / project.settings.bpm);

    synthsRef.current = activeLayers.map((layer) => {
      const synth = makeSynth(layer);
      for (const note of layer.notes) {
        Tone.getTransport().schedule((time) => {
          synth.triggerAttackRelease(note.pitch, note.durationBeats * (60 / project.settings.bpm), time, note.velocity ?? 0.8);
        }, note.time * (60 / project.settings.bpm));
      }
      return synth;
    });

    Tone.getTransport().start();
    setIsPlaying(true);
    setStatus("Playing local 8/16 bar synth loop.");
  };

  const stopPlayback = () => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    synthsRef.current.forEach((synth) => synth.dispose());
    synthsRef.current = [];
    setIsPlaying(false);
  };

  const handleExportWav = async () => {
    if (!project.layers.length) return;

    setIsRendering(true);
    setError(null);
    setStatus("Rendering local synth loop to WAV...");

    try {
      const blob = await renderLoopWav(project.layers, project.settings.bpm, loopBeats);
      const url = await blobToDataUrl(blob);
      addExport({ type: "wav", name: `${project.title || "humsync-loop"}.wav`, url });
      setStatus("WAV export ready.");
    } catch (caught) {
      console.error(caught);
      setError("WAV export failed. The loop is still playable; try again after stopping playback.");
    } finally {
      setIsRendering(false);
    }
  };

  const handleExportMidi = async () => {
    if (!project.layers.length) return;

    const blob = exportMidi(project.layers, project.settings.bpm);
    const url = await blobToDataUrl(blob);
    addExport({ type: "midi", name: `${project.title || "humsync-loop"}.mid`, url });
    setStatus("MIDI export ready.");
  };

  const handleEnhanceWithLyria = async () => {
    if (!project.layers.length) return;

    setIsEnhancing(true);
    setError(null);
    setStatus("Requesting optional Lyria render. Local WAV/MIDI will remain available if this fails.");

    try {
      const url = await generateFullTrack(buildLyriaPrompt(project.settings, project.layers, project.ideaText));
      if (!url) throw new Error("No Lyria audio returned.");
      const blob = await fetch(url).then((response) => response.blob());
      const dataUrl = await blobToDataUrl(blob);
      addExport({ type: "lyria", name: `${project.title || "humsync-loop"}-lyria.wav`, url: dataUrl });
      setStatus("Lyria render ready.");
    } catch (caught) {
      console.error(caught);
      setError("AI audio enhance is unavailable right now. Your local synth loop and WAV/MIDI exports still work.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const addExport = (input: Omit<ExportResult, "id" | "createdAt">) => {
    setProject((current) => ({
      ...current,
      exports: [
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          ...input,
        },
        ...current.exports,
      ],
      updatedAt: new Date().toISOString(),
    }));
    setStage("export");
  };

  const handleNewProject = async () => {
    stopPlayback();
    await clearCurrentProject().catch(() => undefined);
    setProject(createProject());
    setStage("capture");
    setError(null);
    setStatus("New loop ready.");
  };

  const confidence = project.analysis?.confidence ?? 0;
  const selectedPreset = SOUND_PRESETS.find((preset) => preset.id === project.settings.preset);
  const selectedRole = LAYER_ROLES.find((role) => role.id === project.settings.targetRole);

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(90deg,#1f293720_1px,transparent_1px),linear-gradient(#1f293720_1px,transparent_1px)] bg-[size:36px_36px]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(34,197,94,.15),transparent_24%),radial-gradient(circle_at_80%_0%,rgba(239,68,68,.1),transparent_25%),radial-gradient(circle_at_50%_90%,rgba(56,189,248,.13),transparent_30%)]" />

      <header className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-secondary">Brain to loop studio</p>
            <h1 className="mt-2 text-4xl font-black uppercase tracking-tight md:text-6xl">
              HUM<span className="text-accent">SYNC</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-secondary">
              Capture a hummed idea, clean it into a playable 8/16 bar loop, arrange support layers, and export WAV plus MIDI.
            </p>
          </div>
          <div className="hardware-card flex items-center gap-3 p-3">
            <Save className="h-4 w-4 text-accent" />
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-secondary">Local save</p>
              <p className="text-xs">IndexedDB project autosave</p>
            </div>
          </div>
        </div>

        <nav className="grid grid-cols-4 gap-2">
          {STAGES.map((item, index) => {
            const Icon = item.icon;
            const active = item.id === stage;
            return (
              <button
                key={item.id}
                onClick={() => setStage(item.id)}
                className={cn(
                  "rounded-lg border px-2 py-3 text-left transition-all",
                  active ? "border-accent bg-accent/15 text-white" : "border-border/50 bg-black/30 text-secondary hover:border-white/30",
                )}
              >
                <div className="flex items-center justify-between">
                  <Icon className={cn("h-4 w-4", active && "text-accent")} />
                  <span className="font-mono text-[9px]">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="mt-2 text-[10px] font-bold uppercase tracking-widest">{item.label}</div>
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 pb-10 md:px-8 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-6">
          <Panel title="Loop Controls" icon={<Sliders className="h-4 w-4" />}>
            <div className="space-y-5">
              <Field label="Loop Length">
                <div className="grid grid-cols-2 gap-2">
                  {LOOP_BARS.map((bars) => (
                    <ChoiceButton key={bars} active={project.settings.bars === bars} onClick={() => updateSettings({ bars })}>
                      {bars} bars
                    </ChoiceButton>
                  ))}
                </div>
              </Field>

              <Field label={`Tempo: ${project.settings.bpm} BPM`}>
                <input
                  type="range"
                  min="70"
                  max="180"
                  value={project.settings.bpm}
                  onChange={(event) => updateSettings({ bpm: Number(event.target.value) })}
                  className="w-full accent-accent"
                />
              </Field>

              <Field label="Key / Scale">
                <div className="grid grid-cols-4 gap-2">
                  {MUSICAL_KEYS.map((key) => (
                    <ChoiceButton key={key} active={project.settings.key === key} onClick={() => updateSettings({ key })}>
                      {key}
                    </ChoiceButton>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {MUSICAL_SCALES.map((scale) => (
                    <ChoiceButton key={scale} active={project.settings.scale === scale} onClick={() => updateSettings({ scale })}>
                      {scale}
                    </ChoiceButton>
                  ))}
                </div>
              </Field>

              <Field label="Focused Preset">
                <div className="space-y-2">
                  {SOUND_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => updateSettings({ preset: preset.id })}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-all",
                        project.settings.preset === preset.id ? "border-white/60 bg-white/10" : "border-border/50 bg-black/30 hover:border-white/30",
                      )}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-widest">{preset.name}</div>
                      <div className="mt-1 text-[10px] text-secondary">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </Panel>
        </aside>

        <section className="space-y-6">
          <StatusBar status={status} error={error} />

          {stage === "capture" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <Panel title="Capture The Idea" icon={<Mic className="h-4 w-4" />}>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-[0.25em] text-secondary">Idea context</label>
                    <textarea
                      value={project.ideaText}
                      onChange={(event) => setProject((current) => ({ ...current, ideaText: event.target.value }))}
                      placeholder="Dark bouncing synth hook, like a late-night loop with a sharp bass answer..."
                      className="mt-2 min-h-28 w-full rounded-lg border border-border/60 bg-black/40 p-4 text-sm outline-none focus:border-accent"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {LAYER_ROLES.map((role) => (
                      <button
                        key={role.id}
                        onClick={() => updateSettings({ targetRole: role.id })}
                        className={cn(
                          "rounded-lg border p-4 text-left transition-all",
                          project.settings.targetRole === role.id ? "border-accent bg-accent/10" : "border-border/50 bg-black/30 hover:border-white/30",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{role.name}</span>
                        </div>
                        <p className="mt-2 text-[10px] text-secondary">{role.desc}</p>
                      </button>
                    ))}
                  </div>

                  <AudioRecorder onRecordingComplete={handleRecordingComplete} onError={handleAnalyzeError} isProcessing={isAnalyzing} />
                </div>
              </Panel>

              <Panel title="V1 Target" icon={<Activity className="h-4 w-4" />}>
                <div className="space-y-4 text-sm text-secondary">
                  <Metric label="Output" value={`${project.settings.bars} bar loop`} />
                  <Metric label="Preset" value={selectedPreset?.name || project.settings.preset} />
                  <Metric label="Role" value={selectedRole?.name || project.settings.targetRole} />
                  <div className="rounded-lg border border-accent/30 bg-accent/10 p-4 text-xs leading-relaxed text-white">
                    The goal is not magic full-song production. The goal is a recognizable, editable loop from the sound in your head.
                  </div>
                  <button onClick={handleStarterLoop} className="w-full rounded-lg border border-border/60 py-3 text-[10px] font-bold uppercase tracking-widest hover:border-white/40">
                    Load starter loop
                  </button>
                </div>
              </Panel>
            </motion.div>
          )}

          {stage === "clean" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Panel title="Hum Fidelity Preview" icon={<Check className="h-4 w-4" />}>
                {project.analysis ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      <Metric label="Confidence" value={`${confidence}%`} />
                      <Metric label="Detected key" value={project.analysis.detectedKey} />
                      <Metric label="Raw notes" value={String(project.analysis.segmentedNotes.length)} />
                      <Metric label="Clean notes" value={String(project.analysis.cleanedNotes.length)} />
                    </div>

                    <div className="h-40 rounded-lg border border-border/60 bg-black/40 p-4">
                      <PitchPreview analysis={project.analysis} />
                    </div>

                    {project.recordingDataUrl && (
                      <audio src={project.recordingDataUrl} controls className="w-full" />
                    )}

                    <div className={cn("rounded-lg border p-4 text-sm", confidence >= 45 ? "border-accent/30 bg-accent/10" : "border-red-400/30 bg-red-400/10")}>
                      {project.analysis.fidelitySummary}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button onClick={() => setStage("capture")} className="flex-1 rounded-lg border border-border/60 py-4 text-[10px] font-bold uppercase tracking-widest hover:border-white/40">
                        Record again
                      </button>
                      <button onClick={handleArrange} disabled={isArranging} className="flex-1 rounded-lg bg-accent py-4 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50">
                        {isArranging ? "Arranging..." : "Accept and arrange"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="No hum analysis yet" body="Record a melody first, then the cleaned note preview will appear here." />
                )}
              </Panel>
            </motion.div>
          )}

          {stage === "arrange" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <Panel title="Playable Loop" icon={<Play className="h-4 w-4" />}>
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button onClick={playLoop} className="flex-1 rounded-lg bg-accent py-4 text-[10px] font-bold uppercase tracking-widest text-white">
                      {isPlaying ? <Square className="mr-2 inline h-4 w-4" /> : <Play className="mr-2 inline h-4 w-4" />}
                      {isPlaying ? "Stop loop" : "Play loop"}
                    </button>
                    <button onClick={() => setStage("export")} className="flex-1 rounded-lg border border-border/60 py-4 text-[10px] font-bold uppercase tracking-widest hover:border-white/40">
                      Export
                    </button>
                  </div>

                  <div className="space-y-3">
                    {project.layers.map((layer) => (
                      <LayerStrip
                        key={layer.id}
                        layer={layer}
                        onMute={() => toggleLayer(layer.id, "mute")}
                        onSolo={() => toggleLayer(layer.id, "solo")}
                        onVolume={(value) => setLayerVolume(layer.id, value)}
                      />
                    ))}
                    {project.layers.length === 0 && <EmptyState title="No loop layers yet" body="Accept a cleaned hum or load a starter loop." />}
                  </div>
                </div>
              </Panel>

              <Panel title="Producer Notes" icon={<Bot className="h-4 w-4" />}>
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-secondary">{project.aiNotes || "Arrange a hum to get producer guidance."}</p>
                  {project.analysis && (
                    <button onClick={handleArrange} disabled={isArranging} className="w-full rounded-lg border border-border/60 py-3 text-[10px] font-bold uppercase tracking-widest hover:border-white/40 disabled:opacity-50">
                      {isArranging ? "Regenerating..." : "Regenerate arrangement"}
                    </button>
                  )}
                </div>
              </Panel>
            </motion.div>
          )}

          {stage === "export" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <Panel title="Export The Loop" icon={<Download className="h-4 w-4" />}>
                <div className="grid gap-4 md:grid-cols-3">
                  <ExportButton icon={<FileAudio />} title="Render WAV" body="Local synth loop. Works without AI audio." loading={isRendering} onClick={handleExportWav} />
                  <ExportButton icon={<FileMusic />} title="Export MIDI" body="Editable notes for your DAW." onClick={handleExportMidi} />
                  <ExportButton icon={<Wand2 />} title="AI Enhance" body="Optional Lyria render when available." loading={isEnhancing} onClick={handleEnhanceWithLyria} />
                </div>
              </Panel>

              <Panel title="Downloads" icon={<Download className="h-4 w-4" />}>
                <div className="space-y-3">
                  {project.exports.map((item) => (
                    <a key={item.id} href={item.url} download={item.name} className="flex items-center justify-between rounded-lg border border-border/60 bg-black/30 p-3 hover:border-white/40">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest">{item.name}</div>
                        <div className="text-[9px] text-secondary">{item.type.toUpperCase()} • {new Date(item.createdAt).toLocaleTimeString()}</div>
                      </div>
                      <Download className="h-4 w-4 text-accent" />
                    </a>
                  ))}
                  {project.exports.length === 0 && <EmptyState title="No exports yet" body="Render WAV or MIDI to create downloads." />}
                </div>
              </Panel>
            </motion.div>
          )}
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-3 border-t border-border/20 px-4 py-6 text-[9px] font-mono uppercase tracking-[0.25em] text-secondary md:flex-row md:items-center md:justify-between md:px-8">
        <span>V1 focus: hum fidelity, guided arrangement, WAV + MIDI</span>
        <button onClick={handleNewProject} className="flex items-center gap-2 hover:text-white">
          <RefreshCw className="h-3 w-3" /> New project
        </button>
      </footer>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="hardware-card p-5">
      <div className="mb-5 flex items-center gap-2">
        <span className="text-accent">{icon}</span>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.25em]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-mono uppercase tracking-[0.25em] text-secondary">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ChoiceButton({ active, onClick, children }: { key?: React.Key; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("rounded-lg border px-2 py-2 text-[10px] font-bold uppercase tracking-widest transition-all", active ? "border-accent bg-accent/15 text-white" : "border-border/50 bg-black/30 text-secondary hover:border-white/30")}>
      {children}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-black/30 p-4">
      <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-secondary">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function StatusBar({ status, error }: { status: string; error: string | null }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-4", error ? "border-red-400/40 bg-red-400/10" : "border-border/50 bg-black/30")}>
      {error ? <AlertTriangle className="h-5 w-5 text-red-400" /> : <Activity className="h-5 w-5 text-accent" />}
      <div>
        <div className="text-[9px] font-mono uppercase tracking-[0.25em] text-secondary">{error ? "Action needed" : "System status"}</div>
        <div className="text-sm">{error || status}</div>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
      <div className="text-sm font-bold uppercase tracking-widest text-white">{title}</div>
      <p className="mt-2 text-xs text-secondary">{body}</p>
    </div>
  );
}

function PitchPreview({ analysis }: { analysis: HumAnalysis }) {
  const notes = analysis.cleanedNotes;
  const maxMidi = Math.max(...notes.map((note) => note.midi), 72);
  const minMidi = Math.min(...notes.map((note) => note.midi), 48);
  const range = Math.max(1, maxMidi - minMidi);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 grid grid-rows-4 opacity-30">
        {[0, 1, 2, 3].map((item) => <div key={item} className="border-t border-border/50" />)}
      </div>
      {notes.map((note, index) => {
        const left = `${(note.time / analysis.loopBeats) * 100}%`;
        const width = `${Math.max(1.5, (note.durationBeats / analysis.loopBeats) * 100)}%`;
        const bottom = `${((note.midi - minMidi) / range) * 78 + 8}%`;
        return (
          <div
            key={`${note.pitch}-${note.time}-${index}`}
            className="absolute h-4 rounded bg-accent shadow-[0_0_16px_rgba(59,130,246,.5)]"
            style={{ left, width, bottom }}
            title={`${note.pitch} @ ${note.time}`}
          />
        );
      })}
    </div>
  );
}

function LayerStrip({ layer, onMute, onSolo, onVolume }: { key?: React.Key; layer: LoopLayer; onMute: () => void; onSolo: () => void; onVolume: (value: number) => void }) {
  return (
    <div className="rounded-lg border border-border/50 bg-black/30 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: layer.color }} />
            <span className="text-sm font-bold">{layer.name}</span>
            <span className="rounded border border-border/50 px-2 py-0.5 text-[9px] font-mono uppercase text-secondary">{layer.role}</span>
          </div>
          <p className="mt-1 truncate text-[10px] text-secondary">{layer.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onMute} className={cn("rounded border px-3 py-2 text-[9px] font-bold uppercase", layer.mute ? "border-red-400 text-red-300" : "border-border/60 text-secondary")}>Mute</button>
          <button onClick={onSolo} className={cn("rounded border px-3 py-2 text-[9px] font-bold uppercase", layer.solo ? "border-accent text-accent" : "border-border/60 text-secondary")}>Solo</button>
        </div>
      </div>
      <input type="range" min="0" max="1" step="0.01" value={layer.volume} onChange={(event) => onVolume(Number(event.target.value))} className="mt-4 w-full accent-accent" />
    </div>
  );
}

function ExportButton({ icon, title, body, loading, onClick }: { icon: React.ReactNode; title: string; body: string; loading?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading} className="rounded-lg border border-border/50 bg-black/30 p-5 text-left transition-all hover:border-accent/70 disabled:opacity-50">
      <div className="text-accent">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}</div>
      <div className="mt-4 text-[10px] font-bold uppercase tracking-widest">{title}</div>
      <p className="mt-2 text-[10px] leading-relaxed text-secondary">{body}</p>
    </button>
  );
}

function makeSynth(layer: LoopLayer) {
  const options = layer.role === "bass"
    ? { oscillator: { type: "square" as const }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.2 } }
    : layer.role === "pad" || layer.role === "atmosphere"
      ? { oscillator: { type: "sine" as const }, envelope: { attack: 0.3, decay: 0.4, sustain: 0.8, release: 1.4 } }
      : { oscillator: { type: "sawtooth" as const }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.35, release: 0.25 } };

  const synth = new Tone.PolySynth(Tone.Synth, options);
  const gain = new Tone.Gain(layer.volume).toDestination();
  synth.connect(gain);
  return synth;
}
