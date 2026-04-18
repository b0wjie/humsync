import React, { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { Play, Pause, Download, Music, Sparkles, Loader2, Volume2, Settings2, Activity, Trash2, Layers } from "lucide-react";
import { Note, generateFullTrack, Layer, SPECTRUM_ZONES } from "@/services/gemini";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

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
  
  const synthsRef = useRef<{ [id: string]: Tone.PolySynth }>({});
  const partsRef = useRef<{ [id: string]: Tone.Part }>({});

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      Object.values(synthsRef.current).forEach((s: any) => s.dispose());
      Object.values(partsRef.current).forEach((p: any) => p.dispose());
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
        if (synth) synth.dispose();
        if (part) part.dispose();
        delete synthsRef.current[id];
        delete partsRef.current[id];
      }
    });

    // Add new synths/parts
    layers.forEach(layer => {
      if (!synthsRef.current[layer.id]) {
        let synth: Tone.PolySynth;
        
        if (layer.frequencyZone === "Bass" || layer.frequencyZone === "Sub-bass") {
          const monoSynth = new Tone.PolySynth(Tone.MonoSynth).toDestination();
          monoSynth.set({
            oscillator: { type: "square" },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 },
            // @ts-ignore
            filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.2, baseFrequency: 200, octaves: 2.6 }
          });
          synth = monoSynth;
        } else if (layer.role === "lead") {
          synth = new Tone.PolySynth(Tone.Synth).toDestination();
          synth.set({
            oscillator: { type: "sawtooth" },
            envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1 }
          });
        } else if (layer.role === "ambiance" || layer.role === "texture") {
          const fmSynth = new Tone.PolySynth(Tone.FMSynth).toDestination();
          fmSynth.set({
            envelope: { attack: 1, decay: 0.5, sustain: 1, release: 3 },
            // @ts-ignore
            modulation: { type: "sine" },
            modulationIndex: 10
          });
          synth = fmSynth;
        } else {
          synth = new Tone.PolySynth(Tone.Synth).toDestination();
        }
        
        synthsRef.current[layer.id] = synth;

        if (layer.notes) {
          const part = new Tone.Part((time, note) => {
            synth.triggerAttackRelease(note.pitch, note.duration, time);
          }, layer.notes.map(n => ({ time: n.time, pitch: n.pitch, duration: n.duration })));
          
          part.loop = true;
          part.loopEnd = Math.max(...layer.notes.map(n => n.time + 1), 4);
          part.start(0);
          partsRef.current[layer.id] = part;
        }
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
          <button 
            onClick={togglePlay}
            className="p-2 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
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
                      <button 
                        onClick={() => onRemoveLayer(layer.id)}
                        className="p-1.5 text-secondary/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
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
                      <div className="h-1 flex-1 bg-black rounded-full border border-white/5 relative overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: "80%" }}
                          className="absolute h-full bg-accent/30"
                        />
                      </div>
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
