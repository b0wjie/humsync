import React, { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { Play, Pause, Check, X, Music, Sparkles, Volume2 } from "lucide-react";
import { Note, Layer, SOUND_PRESETS } from "@/services/gemini";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

interface LayerPreviewProps {
  notes: Note[];
  instrument: string;
  role: string;
  preset: string;
  onConfirm: () => void;
  onCancel: () => void;
  onUpdateInstrument: (instrument: string, role: string) => void;
  onUpdatePreset: (preset: string) => void;
  instrumentTypes: { id: string; role: string; icon: string }[];
}

export const LayerPreview: React.FC<LayerPreviewProps> = ({
  notes,
  instrument,
  role,
  preset,
  onConfirm,
  onCancel,
  onUpdateInstrument,
  onUpdatePreset,
  instrumentTypes
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);

  useEffect(() => {
    // Initialize synth
    let synth: Tone.PolySynth;
    
    if (instrument.toLowerCase().includes("bass")) {
      const monoSynth = new Tone.PolySynth(Tone.MonoSynth).toDestination();
      monoSynth.set({
        oscillator: { type: "square" },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 },
        // @ts-ignore
        filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.2, baseFrequency: 200, octaves: 2.6 }
      });
      synth = monoSynth;
    } else if (role === "lead") {
      synth = new Tone.PolySynth(Tone.Synth).toDestination();
      synth.set({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1 }
      });
    } else if (role === "ambiance" || role === "texture" || preset === "ambient") {
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
    
    synthRef.current = synth;

    if (notes.length > 0) {
      const part = new Tone.Part((time, note) => {
        synth.triggerAttackRelease(note.pitch, note.duration, time);
      }, notes.map(n => ({ time: n.time, pitch: n.pitch, duration: n.duration })));
      
      part.loop = true;
      part.loopEnd = Math.max(...notes.map(n => n.time + 1), 4);
      partRef.current = part;
    }

    return () => {
      synth.dispose();
      if (partRef.current) partRef.current.dispose();
    };
  }, [notes, instrument, role, preset]);

  const togglePlay = async () => {
    if (Tone.getTransport().state === "started") {
      Tone.getTransport().pause();
      setIsPlaying(false);
    } else {
      await Tone.start();
      if (partRef.current) partRef.current.start(0);
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="hardware-card p-6 border-accent/60 bg-accent/5 flex flex-col gap-6 w-full max-w-2xl mx-auto"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-accent/20 text-accent">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight uppercase">Audition Layer</h3>
            <p className="text-[10px] font-mono text-secondary uppercase tracking-widest">Review and refine before adding to stack</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onCancel}
            className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          <button 
            onClick={onConfirm}
            className="p-3 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-all flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            <span className="text-xs font-bold uppercase">Add to Stack</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Volume2 className="w-4 h-4 text-accent" />
            <h4 className="text-[10px] font-mono uppercase tracking-widest">Audition Sound</h4>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {instrumentTypes.map(type => (
              <button
                key={type.id}
                onClick={() => onUpdateInstrument(type.id, type.role)}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  instrument === type.id 
                    ? "bg-accent/10 border-accent text-accent" 
                    : "bg-black/20 border-border/30 text-secondary hover:border-border/60"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{type.icon}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{type.id}</span>
                </div>
                {instrument === type.id && <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h4 className="text-[10px] font-mono uppercase tracking-widest">Aesthetic Preset</h4>
          </div>
          
          <div className="grid grid-cols-1 gap-2 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
            {SOUND_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => onUpdatePreset(p.id)}
                className={cn(
                  "text-left p-3 rounded-lg border transition-all",
                  preset === p.id 
                    ? "bg-white/5 border-white/40 text-white" 
                    : "bg-black/20 border-border/30 text-secondary hover:border-border/60"
                )}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5">{p.name}</div>
                <div className="text-[8px] opacity-60 uppercase tracking-tighter">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-border/20" />

      <div className="flex items-center justify-center gap-4">
        <button 
          onClick={togglePlay}
          className="w-full py-4 rounded-xl bg-accent text-white font-bold uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          {isPlaying ? "Stop Audition" : "Start Audition"}
        </button>
      </div>
    </motion.div>
  );
};
