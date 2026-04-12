import React, { useState } from "react";
import { AudioRecorder } from "./components/AudioRecorder";
import { StackMixer } from "./components/StackMixer";
import { StackVisualizer } from "./components/StackVisualizer";
import { LayerPreview } from "./components/LayerPreview";
import { analyzeAndAddLayer, generateText, Layer, StackAnalysis, MUSICAL_KEYS, MUSICAL_SCALES, MUSICAL_MOODS, SOUND_PRESETS, generateFullTrack } from "./services/gemini";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Lightbulb, Download, Music, Settings2, ChevronDown, ChevronRight, ChevronLeft, Activity, Layers, Sliders, RefreshCw } from "lucide-react";
import { cn } from "./lib/utils";

export const INSTRUMENT_TYPES = [
  { id: "Lead Synth", role: "lead", icon: "✨" },
  { id: "Bassline", role: "foundation", icon: "🎸" },
  { id: "Pad / Texture", role: "ambiance", icon: "☁️" },
  { id: "Pluck / Arp", role: "harmony", icon: "🎹" },
  { id: "Atmosphere", role: "texture", icon: "🌌" }
];

const PHASES = [
  { id: 0, label: "Setup", icon: Settings2 },
  { id: 1, label: "Arrange", icon: Layers },
  { id: 2, label: "Master", icon: Sliders }
];

export default function App() {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
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
  
  const [selectedKey, setSelectedKey] = useState("C");
  const [selectedScale, setSelectedScale] = useState("Major");
  const [selectedMood, setSelectedMood] = useState("Euphoric");
  const [selectedPreset, setSelectedPreset] = useState("cinematic");
  const [bpm, setBpm] = useState(120);
  const [targetInstrument, setTargetInstrument] = useState(INSTRUMENT_TYPES[0]);

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
          notes: analysis.layerAnalysis.notes
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

  const updatePendingInstrument = (instrument: string, role: string) => {
    if (pendingLayer) {
      setPendingLayer({ ...pendingLayer, instrument, role });
    }
  };

  const updatePendingPreset = (preset: string) => {
    setSelectedPreset(preset);
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

  const handleAddCountermelody = async () => {
    setIsGeneratingCountermelody(true);
    try {
      const prompt = `Suggest a countermelody for the current stack: ${layers.map(l => l.instrument).join(', ')}. 
      The project is ${selectedMood}, ${selectedKey} ${selectedScale}, ${bpm} BPM. 
      Provide a musical description and the ideal instrument for this countermelody.`;
      
      const text = await generateText(prompt);
      setNextSuggestion(text);
      setCurrentPhase(1); // Go back to arrange to record it
    } catch (err) {
      console.error("Failed to add countermelody:", err);
    } finally {
      setIsGeneratingCountermelody(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center py-8 px-4 bg-[#0a0a0a] text-white">
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
        <div className="flex items-center gap-2 hardware-card px-4 py-2 bg-black/40">
          {PHASES.map((phase, idx) => (
            <React.Fragment key={phase.id}>
              <button
                onClick={() => setCurrentPhase(phase.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1 rounded transition-all",
                  currentPhase === phase.id ? "text-accent" : "text-secondary hover:text-white"
                )}
              >
                <phase.icon className="w-4 h-4" />
                <span className="text-[8px] font-mono uppercase tracking-widest">{phase.label}</span>
              </button>
              {idx < PHASES.length - 1 && <div className="w-px h-6 bg-border/30 mx-1" />}
            </React.Fragment>
          ))}
        </div>
      </motion.header>

      <main className="w-full max-w-7xl relative z-10">
        <AnimatePresence mode="wait">
          {currentPhase === 0 && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <div className="hardware-card p-6 space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-accent" />
                  <h3 className="text-[10px] font-mono uppercase tracking-widest">Mood & Vibe</h3>
                </div>
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
                  <div className="text-4xl font-black font-mono text-accent bpm-value">{bpm}</div>
                  <div className="text-[10px] font-mono uppercase text-secondary tracking-[0.3em] bpm-label">Beats Per Minute</div>
                  <input 
                    type="range" min="60" max="200" value={bpm} 
                    onChange={(e) => setBpm(parseInt(e.target.value))}
                    className="w-full accent-accent"
                  />
                  <div className="flex justify-between w-full text-[8px] font-mono text-secondary uppercase">
                    <span>Slow</span>
                    <span>Fast</span>
                  </div>
                </div>
                <button 
                  onClick={() => setCurrentPhase(1)}
                  className="w-full py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-accent/90 transition-all"
                >
                  Start Arranging <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {currentPhase === 1 && (
            <motion.div
              key="arrange"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-8"
            >
              <AnimatePresence>
                {pendingLayer && (
                  <LayerPreview 
                    notes={pendingLayer.notes || []}
                    instrument={pendingLayer.instrument}
                    role={pendingLayer.role}
                    preset={selectedPreset}
                    onConfirm={confirmLayer}
                    onCancel={cancelLayer}
                    onUpdateInstrument={updatePendingInstrument}
                    onUpdatePreset={updatePendingPreset}
                    instrumentTypes={INSTRUMENT_TYPES}
                  />
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="hardware-card p-6 flex flex-col gap-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Music className="w-4 h-4 text-accent" />
                    <h3 className="text-[10px] font-mono uppercase tracking-widest">Recording Mode</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {INSTRUMENT_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => setTargetInstrument(type)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-all group",
                          targetInstrument.id === type.id 
                            ? "bg-accent/10 border-accent text-accent" 
                            : "bg-black/20 border-border/30 text-secondary hover:border-border/60"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{type.icon}</span>
                          <div className="flex flex-col items-start">
                            <span className="text-[10px] font-bold uppercase tracking-wider">{type.id}</span>
                            <span className="text-[8px] opacity-60 uppercase tracking-tighter">{type.role}</span>
                          </div>
                        </div>
                        {targetInstrument.id === type.id && <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                      </button>
                    ))}
                  </div>
                  <AudioRecorder onRecordingComplete={handleRecordingComplete} isProcessing={isProcessing} />
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-6">
                <StackVisualizer spectrumMap={spectrumMap} coverageScore={coverageScore} />
                <div className="hardware-card p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <h3 className="text-[10px] font-mono uppercase tracking-widest">Sound Preset</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {SOUND_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => setSelectedPreset(preset.id)}
                        className={cn(
                          "text-left p-3 rounded-lg border transition-all relative overflow-hidden",
                          selectedPreset === preset.id ? "bg-white/5 border-white/40 text-white" : "bg-black/20 border-border/30 text-secondary hover:border-border/60"
                        )}
                      >
                        {selectedPreset === preset.id && <motion.div layoutId="preset-bg" className="absolute inset-0 bg-accent/10 -z-10" />}
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5 flex items-center justify-between">
                          {preset.name}
                          {selectedPreset === preset.id && <Sparkles className="w-3 h-3 text-accent" />}
                        </div>
                        <div className="text-[8px] opacity-60 leading-tight uppercase tracking-tighter">{preset.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col gap-6">
              <StackMixer 
                layers={layers} 
                onRemoveLayer={removeLayer} 
                onFinalize={setFinalTrackUrl} 
                bpm={bpm}
                selectedKey={selectedKey}
                selectedScale={selectedScale}
                selectedMood={selectedMood}
                selectedPreset={selectedPreset}
              />
                <button 
                  onClick={() => setCurrentPhase(2)}
                  className="w-full py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-accent/90 transition-all"
                >
                  Go to Master <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

          {currentPhase === 2 && (
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
                      <Sparkles className="w-4 h-4 text-accent" />
                      <h3 className="text-[10px] font-mono uppercase tracking-widest">Next Steps</h3>
                    </div>
                    <div className="space-y-2">
                      <button 
                        onClick={handleExtendTrack}
                        disabled={isExtendingTrack || !finalTrackUrl}
                        className="w-full p-3 rounded-lg bg-black/40 border border-border/30 text-[10px] font-mono uppercase tracking-widest text-left hover:border-accent/50 transition-all flex items-center justify-between group disabled:opacity-50"
                      >
                        {isExtendingTrack ? "Extending..." : "Extend to full track"} 
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                      </button>
                      <button 
                        onClick={handleGenerateLyrics}
                        disabled={isGeneratingLyrics}
                        className="w-full p-3 rounded-lg bg-black/40 border border-border/30 text-[10px] font-mono uppercase tracking-widest text-left hover:border-accent/50 transition-all flex items-center justify-between group disabled:opacity-50"
                      >
                        {isGeneratingLyrics ? "Generating..." : "Generate lyrics"}
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                      </button>
                      <button 
                        onClick={handleAddCountermelody}
                        disabled={isGeneratingCountermelody}
                        className="w-full p-3 rounded-lg bg-black/40 border border-border/30 text-[10px] font-mono uppercase tracking-widest text-left hover:border-accent/50 transition-all flex items-center justify-between group disabled:opacity-50"
                      >
                        {isGeneratingCountermelody ? "Thinking..." : "Add countermelody"}
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
