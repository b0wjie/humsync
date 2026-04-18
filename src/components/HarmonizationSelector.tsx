import React, { useState } from "react";
import { Music, Sparkles, Plus, Check, Play, Pause } from "lucide-react";
import { HarmonizationOption, Note } from "@/services/gemini";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import * as Tone from "tone";

interface HarmonizationSelectorProps {
  options: HarmonizationOption[];
  onSelect: (option: HarmonizationOption) => void;
  onCancel: () => void;
}

export const HarmonizationSelector: React.FC<HarmonizationSelectorProps> = ({ options, onSelect, onCancel }) => {
  const [previewingStyle, setPreviewingStyle] = useState<string | null>(null);
  const synthsRef = React.useRef<{ [key: string]: Tone.PolySynth }>({});
  const partsRef = React.useRef<{ [key: string]: Tone.Part }>({});

  const togglePreview = async (style: string) => {
    if (previewingStyle === style) {
      stopPreview();
      setPreviewingStyle(null);
    } else {
      stopPreview();
      await startPreview(style);
      setPreviewingStyle(style);
    }
  };

  const startPreview = async (style: string) => {
    const option = options.find(o => o.style === style);
    if (!option) return;

    await Tone.start();
    
    option.layers.forEach((layer, idx) => {
      const synth = new Tone.PolySynth(Tone.Synth).toDestination();
      synth.volume.value = -10;
      
      // Basic preset logic for preview
      if (layer.role === "harmony") {
        synth.set({ oscillator: { type: "triangle" }, envelope: { attack: 0.1, release: 1 } });
      } else {
        synth.set({ oscillator: { type: "sine" }, envelope: { attack: 0.5, release: 2 } });
      }

      const part = new Tone.Part((time, note) => {
        synth.triggerAttackRelease(note.pitch, note.duration, time);
      }, layer.notes);

      part.loop = true;
      part.loopEnd = 4; // Assume 4 bar loops for preview
      
      synthsRef.current[`${style}-${idx}`] = synth;
      partsRef.current[`${style}-${idx}`] = part;
      
      part.start(0);
    });

    if (Tone.getTransport().state !== "started") {
      Tone.getTransport().start();
    }
  };

  const stopPreview = () => {
    Object.values(partsRef.current).forEach(p => p.stop().dispose());
    Object.values(synthsRef.current).forEach(s => s.dispose());
    partsRef.current = {};
    synthsRef.current = {};
  };

  React.useEffect(() => {
    return () => stopPreview();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="hardware-card p-8 border-purple-500/40 bg-purple-500/5 space-y-6 w-full max-w-2xl mx-auto shadow-[0_0_50px_rgba(168,85,247,0.15)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight uppercase">AI Harmonization Suggestions</h3>
            <p className="text-[10px] font-mono text-secondary uppercase tracking-widest">Select a musical style to generate complex accompaniments</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {options.map((option) => (
          <div 
            key={option.style}
            className={cn(
              "p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden",
              previewingStyle === option.style 
                ? "bg-purple-500/10 border-purple-500/60 shadow-[0_0_20px_rgba(168,85,247,0.2)]" 
                : "bg-black/40 border-border/30 hover:border-purple-500/40"
            )}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-black uppercase tracking-widest text-white">{option.style}</span>
                  <div className="h-px flex-1 bg-border/20 mx-2" />
                </div>
                <p className="text-[10px] text-secondary/80 font-mono line-clamp-2 uppercase leading-relaxed">
                  {option.description}
                </p>
              </div>

              <div className="flex items-center gap-3 ml-6">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePreview(option.style);
                  }}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                    previewingStyle === option.style ? "bg-purple-500 text-white" : "bg-white/5 text-secondary hover:text-white"
                  )}
                >
                  {previewingStyle === option.style ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(option);
                  }}
                  className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-accent/20"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Visualizer bars for when previewing */}
            {previewingStyle === option.style && (
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-0.5 h-1 opacity-40">
                {Array.from({ length: 40 }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [2, Math.random() * 8 + 2, 2] }}
                    transition={{ repeat: Infinity, duration: 0.5 + Math.random() }}
                    className="w-1 bg-purple-500"
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <button 
          onClick={onCancel}
          className="text-[10px] font-mono uppercase tracking-[0.3em] text-secondary hover:text-white transition-all"
        >
          Dismiss Recommendations
        </button>
      </div>
    </motion.div>
  );
};
