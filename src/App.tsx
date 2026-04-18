import React, { useState, useEffect } from "react";
import * as Tone from "tone";
import { AudioRecorder } from "./components/AudioRecorder";
import { StepSequencer } from "./components/StepSequencer";
import { DrumMachine } from "./components/DrumMachine";
import { PianoRoll } from "./components/PianoRoll";
import { StackMixer } from "./components/StackMixer";
import { StackVisualizer } from "./components/StackVisualizer";
import { LayerPreview } from "./components/LayerPreview";
import { StudioScene } from "./components/StudioScene";
import { HarmonizationSelector } from "./components/HarmonizationSelector";
import { analyzeAndAddLayer, generateText, Layer, StackAnalysis, MUSICAL_KEYS, MUSICAL_SCALES, MUSICAL_MOODS, SOUND_PRESETS, INSTRUMENT_PRESETS, generateFullTrack, generateHarmonizationOptions, HarmonizationOption } from "./services/gemini";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Lightbulb, Download, Music, Settings2, ChevronDown, ChevronRight, ChevronLeft, Activity, Layers, Sliders, RefreshCw, Mic, Power } from "lucide-react";
import { cn } from "./lib/utils";

export const INSTRUMENT_TYPES = [
  { id: "Lead Synth", role: "lead", icon: "✨" },
  { id: "Bassline", role: "foundation", icon: "🎸" },
  { id: "Pad / Texture", role: "ambiance", icon: "☁️" },
  { id: "Pluck / Arp", role: "harmony", icon: "🎹" },
  { id: "Atmosphere", role: "texture", icon: "🌌" },
  { id: "Drum Kit", role: "foundation", icon: "🥁" }
];

const PHASES = [
  { id: 0, label: "Project Goal", icon: Lightbulb },
  { id: 1, label: "Core Setup", icon: Settings2 },
  { id: 2, label: "Arrange", icon: Layers },
  { id: 3, label: "Master", icon: Sliders }
];

interface PhaseIndicatorProps {
  phase: any;
  currentPhase: number;
  onClick: () => void;
  idx: number;
}

const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({ phase, currentPhase, onClick, idx }) => {
  const isActive = currentPhase === phase.id;
  const isSelectable = idx <= currentPhase;
  return (
    <React.Fragment>
      <motion.button
        whileHover={isSelectable ? { scale: 1.05 } : {}}
        whileTap={isSelectable ? { scale: 0.95 } : {}}
        onClick={onClick}
        disabled={!isSelectable}
        className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-lg transition-all relative group overflow-hidden min-w-[100px]",
          isActive ? "bg-accent/10 text-white" : "text-secondary hover:text-white disabled:opacity-30",
          !isActive && isSelectable ? "hover:bg-white/5" : ""
        )}
      >
        <div className={cn(
          "w-1.5 h-1.5 rounded-full",
          isActive ? "bg-accent shadow-[0_0_10px_rgba(59,130,246,0.8)]" : "bg-black inner-shadow"
        )} />
        <span className={cn(
          "text-[9px] font-black uppercase tracking-[0.2em]",
          isActive ? "opacity-100" : "opacity-40"
        )}>
          {phase.label}
        </span>
        {isActive && (
          <motion.div 
            layoutId="active-nav"
            className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
          />
        )}
      </motion.button>
      {idx < PHASES.length - 1 && <div className="w-px h-4 bg-border/20 mx-1" />}
    </React.Fragment>
  );
};

export default function App() {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAudioStarted, setIsAudioStarted] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [spectrumMap, setSpectrumMap] = useState<{ [zone: string]: boolean }>({});
  const [nextSuggestion, setNextSuggestion] = useState<string | null>(null);
  const [coverageScore, setCoverageScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finalTrackUrl, setFinalTrackUrl] = useState<string | null>(null);
  const [pendingLayer, setPendingLayer] = useState<Layer | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<StackAnalysis | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isGeneratingCountermelody, setIsGeneratingCountermelody] = useState(false);
  const [isExtendingTrack, setIsExtendingTrack] = useState(false);
  const [isHarmonizing, setIsHarmonizing] = useState(false);
  const [harmonizationOptions, setHarmonizationOptions] = useState<HarmonizationOption[] | null>(null);
  
  const [selectedKey, setSelectedKey] = useState("C");
  const [selectedScale, setSelectedScale] = useState("Major");
  const [selectedMood, setSelectedMood] = useState("Euphoric");
  const [selectedPreset, setSelectedPreset] = useState("cinematic");
  const [bpm, setBpm] = useState(140);
  const [selectedGenre, setSelectedGenre] = useState("Trap");
  const [targetInstrument, setTargetInstrument] = useState(INSTRUMENT_TYPES[0]);
  const [inputMode, setInputMode] = useState<"hum" | "seq" | "pads" | "keyboard">("hum");

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  const handleRecordingComplete = async (blob: Blob) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64Content = base64data.split(',')[1];
        
        const analysis: StackAnalysis = await analyzeAndAddLayer(
          base64Content, 
          blob.type, 
          layers,
          selectedKey,
          selectedScale,
          selectedMood,
          selectedPreset,
          targetInstrument.id,
          targetInstrument.role
        );
        
        const newLayer: Layer = {
          id: Math.random().toString(36).substr(2, 9),
          role: analysis.layerAnalysis.role,
          instrument: analysis.layerAnalysis.instrument,
          frequencyZone: analysis.layerAnalysis.frequencyZone,
          audioUrl: URL.createObjectURL(blob),
          geminiDescription: analysis.layerAnalysis.description,
          spectrumCoverage: analysis.layerAnalysis.spectrumCoverage,
          notes: analysis.layerAnalysis.notes,
          instrumentPreset: INSTRUMENT_PRESETS[analysis.layerAnalysis.role.toLowerCase() === "foundation" ? "foundation" : 
                            analysis.layerAnalysis.role.toLowerCase() === "lead" ? "lead" : 
                            analysis.layerAnalysis.role.toLowerCase() === "ambiance" ? "ambiance" : 
                            analysis.layerAnalysis.role.toLowerCase() === "texture" ? "texture" : "harmony"]?.[0]?.id || "v-analog"
        };

        setPendingLayer(newLayer);
        setPendingAnalysis(analysis);
        setIsProcessing(false);
      };
    } catch (err) {
      console.error("Layer analysis failed:", err);
      setError("Failed to analyze layer. Try humming more clearly.");
      setIsProcessing(false);
    }
  };

  const removeLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
  };

  const handleUpdateLayer = (id: string, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const confirmLayer = () => {
    if (pendingLayer && pendingAnalysis) {
      setLayers(prev => [...prev, pendingLayer]);
      setSpectrumMap(pendingAnalysis.spectrumMap);
      setNextSuggestion(pendingAnalysis.nextSuggestion);
      setCoverageScore(pendingAnalysis.coverageScore);
      
      if (pendingAnalysis.detectedKey && selectedKey === "Auto-Detect") {
        setSelectedKey(pendingAnalysis.detectedKey);
      }
      
      setPendingLayer(null);
      setPendingAnalysis(null);
    }
  };

  const cancelLayer = () => {
    setPendingLayer(null);
    setPendingAnalysis(null);
  };

  const handleHarmonize = async () => {
    if (!pendingLayer || !pendingLayer.notes) return;
    setIsHarmonizing(true);
    try {
      const options = await generateHarmonizationOptions(
        pendingLayer.notes,
        selectedKey,
        selectedScale,
        selectedMood,
        selectedPreset
      );
      setHarmonizationOptions(options);
    } catch (err) {
      console.error("Harmonization failed:", err);
      setError("Failed to generate harmonization options.");
    } finally {
      setIsHarmonizing(false);
    }
  };

  const applyHarmonization = (option: HarmonizationOption) => {
    const newLayers: Layer[] = option.layers.map(l => ({
      id: Math.random().toString(36).substr(2, 9),
      role: l.role,
      instrument: l.instrument,
      frequencyZone: l.role === "harmony" ? "High-mid" : "Mid",
      audioUrl: "", // Generated layers don't have hummed audio
      geminiDescription: `AI Generated ${option.style} ${l.role}`,
      spectrumCoverage: l.role === "harmony" ? [2000, 6000] : [500, 2000],
      notes: l.notes,
      instrumentPreset: l.instrumentPreset
    }));

    setLayers(prev => [...prev, ...newLayers]);
    setHarmonizationOptions(null);
    // Also include the original melody if it hasn't been added yet
    if (pendingLayer) {
      setLayers(prev => [...prev, pendingLayer]);
      setPendingLayer(null);
      setPendingAnalysis(null);
    }
  };

  const updatePendingInstrument = (instrument: string, role: string) => {
    if (pendingLayer) {
      const defaultPreset = INSTRUMENT_PRESETS[role.toLowerCase() === "foundation" ? "foundation" : 
                             role.toLowerCase() === "lead" ? "lead" : 
                             role.toLowerCase() === "ambiance" ? "ambiance" : 
                             role.toLowerCase() === "texture" ? "texture" : "harmony"]?.[0]?.id || "v-analog";
      setPendingLayer({ ...pendingLayer, instrument, role, instrumentPreset: defaultPreset });
    }
  };

  const updatePendingPreset = (preset: string) => {
    setSelectedPreset(preset);
  };

  const updatePendingInstrumentPreset = (preset: string) => {
    if (pendingLayer) {
      setPendingLayer({ ...pendingLayer, instrumentPreset: preset });
    }
  };

  const handleExtendTrack = async () => {
    if (!finalTrackUrl) return;
    setIsExtendingTrack(true);
    try {
      const prompt = `Extend the current ${selectedMood} track in ${selectedKey} ${selectedScale} (${bpm} BPM). 
      The current track has these layers: ${layers.map(l => l.instrument).join(', ')}. 
      Create a longer, more developed version that builds on these themes.`;
      const url = await generateFullTrack(prompt);
      if (url) setFinalTrackUrl(url);
    } catch (err) {
      console.error("Failed to extend track:", err);
    } finally {
      setIsExtendingTrack(false);
    }
  };

  const handleGenerateLyrics = async () => {
    setIsGeneratingLyrics(true);
    try {
      const lyricsPrompt = `Write lyrics for a ${selectedMood} song in the style of ${selectedPreset}. 
      The song is in ${selectedKey} ${selectedScale}. 
      Themes: ${layers.map(l => l.geminiDescription).join(', ')}.`;
      
      const text = await generateText(lyricsPrompt);
      setLyrics(text);
    } catch (err) {
      console.error("Failed to generate lyrics:", err);
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  const handleAddDirectLayer = (layer: Layer) => {
    setLayers(prev => [...prev, layer]);
    // Optionally trigger analysis for suggestions
  };

  const initAudio = async () => {
    await Tone.start();
    setIsAudioStarted(true);
    console.log("Audio Engine Ready");
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center py-8 px-4 bg-[#050505] text-white">
      {/* 3D HD Scene Integration */}
      <StudioScene 
        activeMode={currentPhase === 3 ? 'master' : inputMode} 
        accentColor={currentPhase === 0 ? "#facc15" : "#3b82f6"} 
      />

      {/* Global Audio Start Overlay */}
      {!isAudioStarted && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="hardware-card p-12 max-w-md shadow-[0_0_100px_rgba(59,130,246,0.3)]"
          >
            <Power className="w-16 h-16 text-accent mx-auto mb-6 animate-pulse" />
            <h2 className="text-2xl font-black uppercase tracking-widest mb-4 italic">Initialize Studio</h2>
            <p className="text-secondary text-xs font-mono mb-8 opacity-60">
              The professional audio engine requires direct user interaction to boot the synthesis cores.
            </p>
            <button 
              onClick={initAudio}
              className="w-full py-5 rounded-2xl bg-accent text-white font-black uppercase tracking-[0.4em] text-xs shadow-[0_0_40px_rgba(59,130,246,0.4)] hover:bg-accent/80 transition-all active:scale-95"
            >
              Boot Engine
            </button>
          </motion.div>
        </div>
      )}

      {/* Background Atmosphere */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-accent/5 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-500/5 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 w-full max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4"
      >
        <div className="flex flex-col items-start">
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3">
            HUM<span className="text-accent">SYNC</span>
            <span className="text-[10px] font-mono bg-accent/20 text-accent px-2 py-1 rounded border border-accent/30 tracking-widest uppercase">v3.0 DAW</span>
          </h1>
          <p className="text-secondary text-[10px] font-mono uppercase tracking-widest mt-1 opacity-60">
            Intelligent Melody Construction Pipeline
          </p>
        </div>

        {/* Phase Navigation */}
        <div className="flex items-center gap-1 hardware-card p-1.5 bg-black/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] border-[#2a2d33]">
          {PHASES.map((phase, idx) => (
            <PhaseIndicator 
              key={phase.id} 
              phase={phase} 
              currentPhase={currentPhase} 
              onClick={() => setCurrentPhase(phase.id)} 
              idx={idx} 
            />
          ))}
        </div>
      </motion.header>

      {/* Interactive Studio Shelf */}
      <div className="studio-shelf">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[8px] font-mono text-secondary uppercase tracking-[0.2em]">Engine Status</span>
            <div className="flex items-center gap-2">
              <motion.div 
                animate={{ scale: isAudioStarted ? [1, 1.2, 1] : 1 }}
                transition={{ repeat: Infinity, duration: 60/bpm, ease: "easeInOut" }}
                className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" 
              />
              <span className="text-[10px] font-black uppercase text-white/80">Active / {bpm} BPM</span>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[8px] font-mono text-secondary uppercase tracking-[0.2em]">Stack Capacity</span>
            <span className="text-[10px] font-black uppercase text-white/80">{layers.length} / 12 Layers</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="lcd-display py-1 px-4 min-w-[150px] text-center">
            <span className="text-accent font-mono text-[9px] tracking-widest uppercase">
              {selectedKey} {selectedScale} // {selectedMood.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-1">
             {Array.from({ length: 12 }).map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-1 h-3 rounded-full transition-all",
                    i < layers.length ? "bg-accent shadow-[0_0_5px_var(--accent-glow)]" : "bg-white/5"
                  )} 
                />
             ))}
          </div>
        </div>
      </div>

      <main className="w-full max-w-7xl relative z-10">
        <AnimatePresence mode="wait">
          {currentPhase === 0 && (
            <motion.div
              key="goal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-3xl mx-auto"
            >
              <div className="hardware-card p-12 space-y-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/30 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-accent">
                    <Sparkles className="w-3 h-3" /> Project Direction v3.0
                  </div>
                  <h2 className="text-5xl font-black tracking-tighter leading-none italic uppercase">
                    The Modern <span className="text-accent underline decoration-accent/30 underline-offset-8">DAW Overhaul</span>
                  </h2>
                  <p className="text-secondary/80 text-sm leading-relaxed max-w-xl mx-auto font-medium">
                    Our goal is to create a polished, production-ready environment that bridges the gap between human intuition and professional synthesis. 
                    Focus on aggressive sound signatures, hard-hitting rhythmic structures, and atmospheric depth.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  {[
                    { label: "Signatures", value: "Boom Bap / Trap / Techno", icon: Music },
                    { label: "Structure", value: "4 / 8 / 16 Bar Loops", icon: Activity },
                    { label: "Sound", value: "Hardware Analog Heat", icon: Settings2 }
                  ].map((stat, i) => (
                    <div key={i} className="hardware-card p-4 bg-black/40 border-border/20">
                      <stat.icon className="w-4 h-4 text-accent mx-auto mb-2 opacity-50" />
                      <div className="text-[8px] font-mono text-secondary uppercase tracking-widest mb-1">{stat.label}</div>
                      <div className="text-[10px] font-black uppercase tracking-tighter">{stat.value}</div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setCurrentPhase(1)}
                  className="px-12 py-5 rounded-2xl bg-accent text-white font-black uppercase tracking-[0.3em] text-xs shadow-[0_0_40px_rgba(59,130,246,0.3)] hover:scale-105 transition-all group"
                >
                  Enter Studio <ChevronRight className="w-4 h-4 inline-block ml-2 group-hover:translate-x-1" />
                </button>
              </div>
            </motion.div>
          )}

          {currentPhase === 1 && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <div className="hardware-card p-6 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-accent" />
                  <h3 className="text-[10px] font-mono uppercase tracking-widest">Genre & Mood</h3>
                </div>
                <div className="space-y-4">
                  <select 
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="w-full bg-black/40 border border-border/30 rounded-lg p-3 text-[10px] font-black uppercase tracking-widest text-white outline-none hover:border-accent/40 transition-colors"
                  >
                    {["Trap", "Hard Techno", "Boom Bap", "Detroit", "Drum & Bass"].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    {MUSICAL_MOODS.map(mood => (
                      <button
                        key={mood}
                        onClick={() => setSelectedMood(mood)}
                        className={cn(
                          "p-3 rounded-lg border text-[10px] font-mono uppercase tracking-widest transition-all",
                          selectedMood === mood ? "bg-accent/20 border-accent text-accent" : "bg-black/20 border-border/30 text-secondary hover:border-border/60"
                        )}
                      >
                        {mood}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hardware-card p-6 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Music className="w-4 h-4 text-accent" />
                  <h3 className="text-[10px] font-mono uppercase tracking-widest">Key & Scale</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2">
                    {MUSICAL_KEYS.map(key => (
                      <button
                        key={key}
                        onClick={() => setSelectedKey(key)}
                        className={cn(
                          "p-2 rounded border text-[10px] font-mono transition-all",
                          selectedKey === key ? "bg-accent/20 border-accent text-accent" : "bg-black/20 border-border/30 text-secondary hover:border-border/60"
                        )}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {MUSICAL_SCALES.map(scale => (
                      <button
                        key={scale}
                        onClick={() => setSelectedScale(scale)}
                        className={cn(
                          "p-2 rounded border text-[10px] font-mono uppercase tracking-widest transition-all",
                          selectedScale === scale ? "bg-accent/20 border-accent text-accent" : "bg-black/20 border-border/30 text-secondary hover:border-border/60"
                        )}
                      >
                        {scale}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hardware-card p-6 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Settings2 className="w-4 h-4 text-accent" />
                  <h3 className="text-[10px] font-mono uppercase tracking-widest">Tempo</h3>
                </div>
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setBpm(Math.max(60, bpm - 1))}
                      className="w-8 h-8 rounded-full border border-border/30 flex items-center justify-center hover:bg-white/5 transition-colors text-secondary"
                    >
                      -
                    </button>
                    <div className="flex flex-col items-center">
                      <div className="text-4xl font-black font-mono text-accent bpm-value leading-none">{bpm}</div>
                      <div className="text-[8px] font-mono uppercase text-secondary tracking-[0.3em] bpm-label mt-1">BPM</div>
                    </div>
                    <button 
                      onClick={() => setBpm(Math.min(200, bpm + 1))}
                      className="w-8 h-8 rounded-full border border-border/30 flex items-center justify-center hover:bg-white/5 transition-colors text-secondary"
                    >
                      +
                    </button>
                  </div>
                  
                  <input 
                    type="range" min="60" max="200" value={bpm} 
                    onChange={(e) => setBpm(parseInt(e.target.value))}
                    className="w-full accent-accent"
                  />
                  <div className="flex justify-between w-full text-[8px] font-mono text-secondary uppercase">
                    <span>Lento</span>
                    <span>Presto</span>
                  </div>
                </div>
                <button 
                  onClick={() => setCurrentPhase(2)}
                  className="w-full py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-accent/90 transition-all"
                >
                  Start Arranging <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {currentPhase === 2 && (
            <motion.div
              key="arrange"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-8"
            >
              <AnimatePresence>
                {pendingLayer && !harmonizationOptions && (
                  <LayerPreview 
                    notes={pendingLayer.notes || []}
                    instrument={pendingLayer.instrument}
                    role={pendingLayer.role}
                    preset={selectedPreset}
                    instrumentPreset={pendingLayer.instrumentPreset || ""}
                    onConfirm={confirmLayer}
                    onCancel={cancelLayer}
                    onUpdateInstrument={updatePendingInstrument}
                    onUpdatePreset={updatePendingPreset}
                    onUpdateInstrumentPreset={updatePendingInstrumentPreset}
                    onHarmonize={handleHarmonize}
                    isHarmonizing={isHarmonizing}
                    instrumentTypes={INSTRUMENT_TYPES}
                  />
                )}
                {harmonizationOptions && (
                  <HarmonizationSelector
                    options={harmonizationOptions}
                    onSelect={applyHarmonization}
                    onCancel={() => setHarmonizationOptions(null)}
                  />
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 flex flex-col gap-6">
                  <div className="hardware-card overflow-hidden">
                    <div className="flex border-b border-white/10">
                      {[
                        { id: "hum", label: "Hum-to-MIDI", icon: Mic },
                        { id: "seq", label: "Step Seq", icon: Activity },
                        { id: "pads", label: "Drum Pads", icon: Music },
                        { id: "keyboard", label: "Piano Roll", icon: Music }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          onClick={() => setInputMode(mode.id as any)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest transition-all",
                            inputMode === mode.id ? "bg-accent text-white" : "text-secondary hover:text-white hover:bg-white/5"
                          )}
                        >
                          <mode.icon className="w-3 h-3" /> {mode.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-4">
                      {inputMode === "hum" && (
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-2">
                              <Settings2 className="w-4 h-4 text-accent" />
                              <h3 className="text-[10px] font-mono uppercase tracking-widest leading-none">Target Calibration</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {INSTRUMENT_TYPES.map(type => (
                                <button
                                  key={type.id}
                                  onClick={() => setTargetInstrument(type)}
                                  className={cn(
                                    "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                                    targetInstrument.id === type.id 
                                      ? "bg-accent/10 border-accent text-accent" 
                                      : "bg-black/20 border-border/30 text-secondary hover:border-border/60"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">{type.icon}</span>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-bold uppercase tracking-wider">{type.id}</span>
                                      <span className="text-[8px] opacity-60 uppercase">{type.role}</span>
                                    </div>
                                  </div>
                                  {targetInstrument.id === type.id && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex-1">
                            <AudioRecorder onRecordingComplete={handleRecordingComplete} isProcessing={isProcessing} />
                          </div>
                        </div>
                      )}
                      {inputMode === "seq" && <StepSequencer onAddLayer={handleAddDirectLayer} bpm={bpm} />}
                      {inputMode === "pads" && <DrumMachine onAddLayer={handleAddDirectLayer} bpm={bpm} />}
                      {inputMode === "keyboard" && <PianoRoll onAddLayer={handleAddDirectLayer} bpm={bpm} />}
                    </div>
                  </div>
                  
                  <StackVisualizer spectrumMap={spectrumMap} coverageScore={coverageScore} />
                </div>

                <div className="lg:col-span-4 flex flex-col gap-6">
                  <StackMixer 
                    layers={layers} 
                    onRemoveLayer={removeLayer} 
                    onUpdateLayer={handleUpdateLayer}
                    onFinalize={setFinalTrackUrl} 
                    bpm={bpm}
                    selectedKey={selectedKey}
                    selectedScale={selectedScale}
                    selectedMood={selectedMood}
                    selectedPreset={selectedPreset}
                  />
                  
                  <div className="hardware-card p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-accent" />
                      <h3 className="text-[10px] font-mono uppercase tracking-widest">Mastering Preset</h3>
                    </div>
                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {["Hip-Hop", "Electronic", "Atmospheric", "Aggressive", "Chill"].map(category => (
                        <div key={category} className="space-y-2">
                          <h4 className="text-[8px] font-mono text-accent uppercase tracking-[0.2em]">{category}</h4>
                          <div className="grid grid-cols-1 gap-2">
                            {SOUND_PRESETS.filter(p => (p as any).category === category).map(preset => (
                              <button
                                key={preset.id}
                                onClick={() => setSelectedPreset(preset.id)}
                                className={cn(
                                  "text-left p-3 rounded-lg border transition-all relative overflow-hidden",
                                  selectedPreset === preset.id ? "bg-white/5 border-white/40 text-white" : "bg-black/20 border-border/30 text-secondary hover:border-border/60"
                                )}
                              >
                                <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5 flex items-center justify-between">
                                  {preset.name}
                                  {selectedPreset === preset.id && <Activity className="w-3 h-3 text-accent" />}
                                </div>
                                <div className="text-[8px] opacity-60 leading-tight uppercase tracking-tighter">{preset.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => setCurrentPhase(3)}
                    className="w-full py-5 rounded-2xl bg-accent text-white font-black uppercase tracking-[0.4em] text-xs hover:bg-accent/90 transition-all shadow-[0_10px_30px_rgba(59,130,246,0.3)] shadow-accent/20"
                  >
                    Go to Master Output
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {currentPhase === 3 && (
            <motion.div
              key="master"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto w-full space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="hardware-card p-8 flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                    <Activity className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter uppercase">Mastering Engine</h2>
                    <p className="text-secondary text-xs font-mono uppercase tracking-widest mt-2">
                      {selectedMood} • {selectedKey} {selectedScale} • {bpm} BPM
                    </p>
                  </div>
                  <div className="w-full h-px bg-border/30" />
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="p-4 rounded-xl bg-black/40 border border-border/30">
                      <div className="text-[8px] font-mono text-secondary uppercase mb-1">Layers</div>
                      <div className="text-xl font-bold">{layers.length}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-black/40 border border-border/30">
                      <div className="text-[8px] font-mono text-secondary uppercase mb-1">Coverage</div>
                      <div className="text-xl font-bold">{coverageScore}/7</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  <AnimatePresence>
                    {finalTrackUrl ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="hardware-card p-8 border-accent/60 bg-accent/10 relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-full h-1 bg-accent animate-pulse" />
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono text-accent uppercase tracking-[0.2em]">Master Output</span>
                            <span className="text-[8px] text-secondary uppercase font-mono">24-bit / 48kHz WAV</span>
                          </div>
                          <a 
                            href={finalTrackUrl} 
                            download="humsync-master.wav"
                            className="p-4 rounded-2xl bg-accent text-white hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 active:scale-95"
                          >
                            <Download className="w-6 h-6" />
                          </a>
                        </div>
                        <audio src={finalTrackUrl} controls className="w-full h-12 accent-accent custom-audio-player" />
                      </motion.div>
                    ) : (
                      <div className="hardware-card p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[200px]">
                        <div className="text-secondary/40 italic text-sm">No master track generated yet.</div>
                        <p className="text-[10px] font-mono text-secondary/60 uppercase tracking-widest">Finalize your mix in the Arrange phase first.</p>
                        <button 
                          onClick={() => setCurrentPhase(1)}
                          className="px-6 py-2 rounded-lg border border-border/50 text-[10px] font-mono uppercase tracking-widest hover:bg-white/5 transition-all"
                        >
                          Back to Arrange
                        </button>
                      </div>
                    )}
                  </AnimatePresence>

                  <div className="hardware-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Music className="w-4 h-4 text-accent" />
                      <h3 className="text-[10px] font-mono uppercase tracking-widest">Post-Processing Suggestions</h3>
                    </div>
                    <div className="space-y-2">
                      <button 
                        onClick={handleExtendTrack}
                        disabled={isExtendingTrack || !finalTrackUrl}
                        className="w-full p-3 rounded-lg bg-black/40 border border-border/30 text-[10px] font-mono uppercase tracking-widest text-left hover:border-accent/50 transition-all flex items-center justify-between group disabled:opacity-50"
                      >
                        {isExtendingTrack ? "Synthesizing Evolution..." : "Evolve Arrangement"} 
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                      </button>
                      <button 
                        onClick={handleGenerateLyrics}
                        disabled={isGeneratingLyrics}
                        className="w-full p-3 rounded-lg bg-black/40 border border-border/30 text-[10px] font-mono uppercase tracking-widest text-left hover:border-accent/50 transition-all flex items-center justify-between group disabled:opacity-50"
                      >
                        {isGeneratingLyrics ? "Extracting Poetry..." : "Generate Vocal Blueprint"}
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                      </button>
                    </div>
                  </div>

                  {lyrics && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="hardware-card p-6 bg-black/60 border-accent/30"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Music className="w-4 h-4 text-accent" />
                        <h3 className="text-[10px] font-mono uppercase tracking-widest">Generated Lyrics</h3>
                      </div>
                      <div className="text-xs font-serif leading-relaxed text-secondary/90 whitespace-pre-wrap max-h-[300px] overflow-y-auto custom-scrollbar italic">
                        {lyrics}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-center pt-4">
                <button 
                  onClick={() => {
                    setLayers([]);
                    setSpectrumMap({});
                    setFinalTrackUrl(null);
                    setCurrentPhase(0);
                  }}
                  className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-secondary hover:text-white transition-all"
                >
                  <RefreshCw className="w-3 h-3" /> Start New Melody
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto py-8 border-t border-border/10 w-full max-w-7xl flex items-center justify-between opacity-40">
        <div className="text-[8px] font-mono uppercase tracking-[0.3em]">
          System Status: Nominal | Buffers: Clear
        </div>
        <div className="text-[8px] font-mono uppercase tracking-[0.3em]">
          Gemini 3.1 Arranger Engine
        </div>
      </footer>
    </div>
  );
}
