import React, { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { Play, Pause, Download, Music, Sparkles, Loader2, Volume2, Settings2, Activity, Trash2, Layers } from "lucide-react";
import { Note, generateFullTrack, Layer, SPECTRUM_ZONES, INSTRUMENT_PRESETS } from "@/services/gemini";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { VUMeter } from "./VUMeter";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface StackMixerProps {
  layers: Layer[];
  onRemoveLayer: (id: string) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onFinalize: (url: string) => void;
  bpm: number;
  selectedKey: string;
  selectedScale: string;
  selectedMood: string;
  selectedPreset: string;
}

export const StackMixer: React.FC<StackMixerProps> = ({ 
  layers, 
  onRemoveLayer, 
  onUpdateLayer,
  onFinalize, 
  bpm,
  selectedKey,
  selectedScale,
  selectedMood,
  selectedPreset
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingTrack, setIsGeneratingTrack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  
  const synthsRef = useRef<{ [id: string]: Tone.PolySynth }>({});
  const partsRef = useRef<{ [id: string]: Tone.Part }>({});
  const metersRef = useRef<{ [id: string]: Tone.Meter }>({});
  const masterMeterRef = useRef<Tone.Meter | null>(null);

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    // Setup master meter
    if (!masterMeterRef.current) {
      const meter = new Tone.Meter();
      Tone.getDestination().connect(meter);
      masterMeterRef.current = meter;
    }

    // Cleanup on unmount
    return () => {
      Object.values(synthsRef.current).forEach((s: any) => s.dispose());
      Object.values(partsRef.current).forEach((p: any) => p.dispose());
      Object.values(metersRef.current).forEach((m: any) => m.dispose());
      if (masterMeterRef.current) {
        masterMeterRef.current.dispose();
        masterMeterRef.current = null;
      }
      Tone.getTransport().stop();
    };
  }, []);

  useEffect(() => {
    // Sync synths and parts with layers
    const currentLayerIds = layers.map(l => l.id);
    
    // Remove old synths/parts
    Object.keys(synthsRef.current).forEach(id => {
      if (!currentLayerIds.includes(id)) {
        const synth = synthsRef.current[id];
        const part = partsRef.current[id];
        const meter = metersRef.current[id];
        if (synth) synth.dispose();
        if (part) part.dispose();
        if (meter) meter.dispose();
        delete synthsRef.current[id];
        delete partsRef.current[id];
        delete metersRef.current[id];
      }
    });

    // Add/Update synths/parts
    layers.forEach(layer => {
      let synth = synthsRef.current[layer.id];
      let needsRebuild = !synth;

      if (needsRebuild) {
        const role = layer.role?.toLowerCase() || "";
        
        if (layer.frequencyZone === "Bass" || layer.frequencyZone === "Sub-bass") {
          synth = new Tone.PolySynth(Tone.MonoSynth).toDestination();
        } else if (role === "lead") {
          synth = new Tone.PolySynth(Tone.MonoSynth).toDestination();
        } else if (role === "ambiance" || role === "texture") {
          synth = new Tone.PolySynth(Tone.FMSynth).toDestination();
        } else {
          synth = new Tone.PolySynth(Tone.Synth).toDestination();
        }

        const meter = new Tone.Meter();
        synth.connect(meter);
        metersRef.current[layer.id] = meter;

        // Apply Preset logic
        const iPreset = layer.instrumentPreset;
        if (iPreset) {
          switch (iPreset) {
            case "v-analog":
              synth.set({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.05, release: 0.5 } });
              break;
            case "fm-bell":
              {
                const fm = new Tone.PolySynth(Tone.FMSynth).toDestination();
                fm.set({ harmonicity: 2, modulationIndex: 10, envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 1 } });
                synth.dispose();
                synth = fm;
                synth.connect(meter);
              }
              break;
            case "acid-wasp":
              synth.set({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.1 } });
              break;
            case "super-saw":
              // @ts-ignore
              synth.set({ oscillator: { type: "fatsawtooth", count: 3, detune: 30 }, envelope: { attack: 0.1, release: 1 } });
              break;
            case "sub-pure":
              synth.set({ oscillator: { type: "sine" }, envelope: { attack: 0.1, release: 1 } });
              break;
            case "fm-grunt":
              {
                const fm = new Tone.PolySynth(Tone.FMSynth).toDestination();
                fm.set({ modulationIndex: 20, oscillator: { type: "square" }, envelope: { attack: 0.05, release: 0.5 } });
                synth.dispose();
                synth = fm;
                synth.connect(meter);
              }
              break;
            case "pluck-bass":
              synth.set({ envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.2 } });
              break;
            case "poly-pluck":
              synth.set({ envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.5 } });
              break;
            case "dream-keys":
              synth.set({ oscillator: { type: "triangle" }, envelope: { attack: 0.1, decay: 1, sustain: 0.5, release: 2 } });
              break;
            case "fm-glass":
              {
                const fm = new Tone.PolySynth(Tone.FMSynth).toDestination();
                fm.set({ harmonicity: 3.5, modulationIndex: 15, envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 1 } });
                synth.dispose();
                synth = fm;
                synth.connect(meter);
              }
              break;
            case "cloud-drift":
              synth.set({ envelope: { attack: 2, release: 4 } });
              break;
            case "space-pad":
              // @ts-ignore
              synth.set({ oscillator: { type: "fmsine", modulationType: "square" }, envelope: { attack: 1, sustain: 1, release: 3 } });
              break;
            case "vocal-haze":
              synth.set({ oscillator: { type: "triangle" }, envelope: { attack: 1.5, release: 5 } });
              break;
            case "dust-grain":
            case "retro-noise":
              synth.set({ envelope: { release: 0.1 } });
              break;
          }
        }
        
        synthsRef.current[layer.id] = synth;
      }

      // Apply custom parameters
      if (layer.params && synth) {
        const { attack, decay, sustain, release, detune, oscillatorType } = layer.params;
        if (oscillatorType) synth.set({ oscillator: { type: oscillatorType } });
        if (detune !== undefined) synth.set({ detune: detune });
        
        const env: any = {};
        if (attack !== undefined) env.attack = attack;
        if (decay !== undefined) env.decay = decay;
        if (sustain !== undefined) env.sustain = sustain;
        if (release !== undefined) env.release = release;
        
        if (Object.keys(env).length > 0) {
          synth.set({ envelope: env });
        }
      }

      if (!partsRef.current[layer.id] && layer.notes) {
        const part = new Tone.Part((time, note) => {
          synthsRef.current[layer.id]?.triggerAttackRelease(note.pitch, note.duration, time);
        }, layer.notes.map(n => ({ time: n.time, pitch: n.pitch, duration: n.duration })));
        
        part.loop = true;
        part.loopEnd = Math.max(...layer.notes.map(n => n.time + 1), 4);
        part.start(0);
        partsRef.current[layer.id] = part;
      }
    });
  }, [layers]);

  const togglePlay = async () => {
    if (Tone.getTransport().state === "started") {
      Tone.getTransport().pause();
      setIsPlaying(false);
    } else {
      await Tone.start();
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  };

  const handleEnhance = async () => {
    setError(null);
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
      try {
        await window.aistudio.openSelectKey();
      } catch (err) {
        return;
      }
    }

    setIsGeneratingTrack(true);
    try {
      // Build a detailed mixing prompt based on the current stack
      const layerDetails = layers.map(l => `- ${l.instrument} (${l.role}): ${l.geminiDescription} [${l.frequencyZone}]`).join('\n');
      
      let mixInstructions = `Ensure a balanced mix across the full frequency spectrum that fits a ${selectedMood} mood. `;
      mixInstructions += `The track is in ${selectedKey} ${selectedScale} at ${bpm} BPM. `;
      mixInstructions += `Apply a ${selectedPreset} aesthetic to the overall sound. `;
      
      if (layers.some(l => l.role === 'foundation' || l.frequencyZone === 'Bass' || l.frequencyZone === 'Sub-bass')) {
        mixInstructions += " Focus on a tight, punchy low-end that doesn't muddy the mids.";
      }
      if (layers.some(l => l.role === 'ambiance' || l.frequencyZone === 'Air')) {
        mixInstructions += " Add subtle reverb and spatial depth to the atmospheric elements.";
      }
      if (layers.some(l => l.role === 'lead')) {
        mixInstructions += " Ensure the lead elements are clear and prominent in the center of the mix.";
      }
      if (layers.length > 3) {
        mixInstructions += " Carefully manage frequency masking to ensure every instrument has its own space.";
      }

      const prompt = `Create a professional full music track by mixing these layers:
${layerDetails}

Mixing Instructions:
${mixInstructions}
The final output should be a cohesive, polished composition that respects the character of each recorded layer.`;

      const url = await generateFullTrack(prompt);
      if (url) onFinalize(url);
    } catch (err: any) {
      setError("Enhancement failed. Please check your API key.");
      if (err.message?.includes("403") && window.aistudio) await window.aistudio.openSelectKey();
    } finally {
      setIsGeneratingTrack(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <div className="hardware-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <h3 className="text-[10px] font-mono uppercase tracking-widest">Active Stack</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <span className="text-[7px] font-mono text-secondary uppercase tracking-widest">Master</span>
              <VUMeter 
                meter={masterMeterRef.current} 
                className="w-20" 
                orientation="horizontal" 
              />
            </div>
            <div className="h-4 w-px bg-white/10" />
            <button 
              onClick={togglePlay}
              className="p-2 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {layers.map((layer) => {
            const zoneInfo = SPECTRUM_ZONES.find(z => z.name === layer.frequencyZone);
            
            return (
              <div key={layer.id} className="flex flex-col gap-4 p-5 hardware-card bg-black/40 border-border/30 group hover:border-accent/40 transition-all hardware-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#0d1117] flex flex-col items-center justify-center border border-[#1e293b] shadow-inner relative overflow-hidden group-hover:border-accent/30 transition-all">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-white/5" />
                    <span className="text-accent font-black text-xs relative z-10">{layer.instrument.charAt(0).toUpperCase()}</span>
                    <div className="absolute bottom-1 w-6 h-0.5 bg-accent/20 rounded-full" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-white/90">{layer.instrument}</span>
                        <div className="px-2 py-0.5 rounded-sm bg-accent/10 border border-accent/20 text-accent text-[7px] font-mono uppercase tracking-widest">
                          {layer.role}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setEditingLayerId(editingLayerId === layer.id ? null : layer.id)}
                          className={cn(
                            "p-1.5 rounded-lg transition-all",
                            editingLayerId === layer.id ? "text-accent bg-accent/10" : "text-secondary/40 hover:text-accent hover:bg-accent/10"
                          )}
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => onRemoveLayer(layer.id)}
                          className="p-1.5 text-secondary/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    
                    {editingLayerId === layer.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="mb-4 space-y-4 overflow-hidden"
                      >
                        <div className="p-4 bg-black/60 rounded-xl border border-white/5 space-y-4">
                          <div className="space-y-2">
                             <label className="text-[8px] font-mono text-secondary uppercase tracking-widest">Oscillator Type</label>
                             <div className="grid grid-cols-3 gap-1">
                               {["sine", "square", "sawtooth", "triangle", "fmsine", "fatsawtooth"].map(type => (
                                 <button
                                   key={type}
                                   onClick={() => onUpdateLayer(layer.id, { params: { ...layer.params, oscillatorType: type as any } })}
                                   className={cn(
                                     "py-1.5 rounded bg-white/5 border border-white/5 text-[7px] font-black uppercase tracking-widest transition-all",
                                     layer.params?.oscillatorType === type ? "border-accent text-accent bg-accent/5" : "hover:bg-white/10"
                                   )}
                                 >
                                   {type}
                                 </button>
                               ))}
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {[
                              { label: "Attack", key: "attack", min: 0.001, max: 2, step: 0.01 },
                              { label: "Decay", key: "decay", min: 0.1, max: 4, step: 0.1 },
                              { label: "Sustain", key: "sustain", min: 0, max: 1, step: 0.05 },
                              { label: "Release", key: "release", min: 0.1, max: 5, step: 0.1 }
                            ].map(param => (
                              <div key={param.key} className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <label className="text-[7px] font-mono text-secondary uppercase tracking-[0.2em]">{param.label}</label>
                                  <span className="text-[7px] font-mono text-accent">{(layer.params as any)?.[param.key] || 0.1}s</span>
                                </div>
                                <input 
                                  type="range"
                                  min={param.min}
                                  max={param.max}
                                  step={param.step}
                                  value={(layer.params as any)?.[param.key] || 0.1}
                                  onChange={(e) => onUpdateLayer(layer.id, { params: { ...layer.params, [param.key]: parseFloat(e.target.value) } })}
                                  className="w-full h-1 bg-white/10 rounded-full appearance-none accent-accent cursor-pointer"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[7px] font-mono text-secondary uppercase tracking-[0.2em]">Detune / Spread</label>
                              <span className="text-[7px] font-mono text-accent">{layer.params?.detune || 0} cents</span>
                            </div>
                            <input 
                              type="range"
                              min="-1200"
                              max="1200"
                              step="10"
                              value={layer.params?.detune || 0}
                              onChange={(e) => onUpdateLayer(layer.id, { params: { ...layer.params, detune: parseInt(e.target.value) } })}
                              className="w-full h-1 bg-white/10 rounded-full appearance-none accent-accent cursor-pointer"
                            />
                          </div>

                          <div className="space-y-2">
                             <label className="text-[8px] font-mono text-secondary uppercase tracking-widest">Library Presets</label>
                             <select 
                               value={layer.instrumentPreset || "v-analog"}
                               onChange={(e) => onUpdateLayer(layer.id, { instrumentPreset: e.target.value })}
                               className="w-full bg-black/40 border border-border/30 rounded-lg p-2 text-[8px] font-black uppercase tracking-widest text-white outline-none"
                             >
                               {Object.values(INSTRUMENT_PRESETS).flat().map(p => (
                                 <option key={p.id} value={p.id}>{p.name}</option>
                               ))}
                             </select>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div 
                          className="w-1.5 h-1.5 rounded-full led-indicator" 
                          style={{ color: zoneInfo?.color || '#ccc' }} 
                        />
                        <span className="text-[8px] font-mono text-secondary uppercase tracking-widest">
                          {layer.frequencyZone}
                        </span>
                      </div>
                      <VUMeter 
                        meter={metersRef.current[layer.id] || null} 
                        className="flex-1" 
                        orientation="horizontal" 
                      />
                    </div>
                  </div>
                </div>
                
                <div className="lcd-display py-2 px-3 opacity-60 group-hover:opacity-90 transition-opacity">
                  <p className="text-[9px] font-mono text-accent leading-relaxed italic uppercase tracking-tighter">
                    // ANALYZING_CHARACTER: "{layer.geminiDescription}"
                  </p>
                </div>
              </div>
            );
          })}
          {layers.length === 0 && (
            <div className="text-center py-12 text-secondary/40 text-[10px] font-mono uppercase italic border-2 border-dashed border-border/20 rounded-xl">
              Stack is empty. Add your first layer.
            </div>
          )}
        </div>

        <button
          onClick={handleEnhance}
          disabled={isGeneratingTrack || layers.length === 0}
          className="w-full h-12 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50 group mt-2"
        >
          {isGeneratingTrack ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5 text-yellow-400 group-hover:scale-125 transition-transform" />
          )}
          FINALIZE MIX
        </button>

        {error && <p className="text-[10px] text-red-400 font-mono text-center">{error}</p>}
      </div>
    </div>
  );
};
