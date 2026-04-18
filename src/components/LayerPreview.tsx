import React, { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { Play, Pause, Check, X, Music, Sparkles, Volume2, Sliders } from "lucide-react";
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
  const [modIndex, setModIndex] = useState(10);
  const [modType, setModType] = useState<Tone.ToneOscillatorType>("sine");
  const [filterDepth, setFilterDepth] = useState(2.5);
  
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);

  useEffect(() => {
    // Initialize effects chain
    const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.1 }).toDestination();
    const distortion = new Tone.Distortion(0).connect(reverb);
    const bitCrusher = new Tone.BitCrusher(8).connect(distortion);
    bitCrusher.wet.value = 0;
    const filter = new Tone.Filter(20000, "lowpass").connect(bitCrusher);
    
    // Initialize synth
    let synth: Tone.PolySynth;
    
    if (instrument.toLowerCase().includes("bass")) {
      const monoSynth = new Tone.PolySynth(Tone.MonoSynth);
      monoSynth.set({
        oscillator: { type: "square" },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 },
        // @ts-ignore
        filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.2, baseFrequency: 200, octaves: 2.6 }
      });
      synth = monoSynth;
    } else if (role === "lead") {
      const monoSynth = new Tone.PolySynth(Tone.MonoSynth);
      monoSynth.set({
        // @ts-ignore
        oscillator: { type: "fmsawtooth", modulationType: modType },
        // @ts-ignore
        modulationIndex: modIndex,
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 1 },
        // @ts-ignore
        filterEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.5, baseFrequency: 200, octaves: filterDepth }
      });
      synth = monoSynth;
    } else if (role === "ambiance" || role === "texture" || preset === "ambient") {
      const fmSynth = new Tone.PolySynth(Tone.FMSynth);
      fmSynth.set({
        envelope: { attack: 1, decay: 0.5, sustain: 1, release: 3 },
        // @ts-ignore
        modulation: { type: "sine" },
        modulationIndex: 10
      });
      synth = fmSynth;
    } else if (instrument.toLowerCase().includes("drum") || role === "percussion") {
      const membraneSynth = new Tone.PolySynth(Tone.MembraneSynth);
      membraneSynth.set({
        pitchDecay: 0.05,
        octaves: 10,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
      });
      synth = membraneSynth;
    } else {
      synth = new Tone.PolySynth(Tone.Synth);
    }

    // Apply preset-specific settings
    switch (preset) {
      case "boom-bap":
        bitCrusher.wet.value = 0.3;
        bitCrusher.bits.value = 12;
        filter.frequency.value = 3000;
        reverb.wet.value = 0.15;
        synth.set({ envelope: { attack: 0.05, release: 0.5 } });
        break;
      case "detroit":
        distortion.distortion = 0.6;
        filter.frequency.value = 1500;
        filter.Q.value = 8;
        synth.set({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.2 } });
        break;
      case "dnb":
        filter.frequency.value = 8000;
        distortion.distortion = 0.2;
        synth.set({ oscillator: { type: "fmsawtooth" }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.4 } });
        break;
      case "hard-techno":
        distortion.distortion = 0.9;
        filter.frequency.value = 12000;
        synth.set({ oscillator: { type: "square" }, envelope: { attack: 0.01, decay: 0.05, sustain: 0.1 } });
        break;
      case "dark-drill":
        filter.frequency.value = 1000;
        reverb.wet.value = 0.4;
        reverb.decay = 4;
        synth.set({ oscillator: { type: "sine" }, envelope: { attack: 0.2, release: 2 } });
        break;
      case "cinematic":
        reverb.decay = 5;
        reverb.wet.value = 0.5;
        filter.frequency.value = 5000;
        synth.set({ envelope: { attack: 0.4, release: 2 } });
        break;
      case "lofi":
        bitCrusher.wet.value = 0.4;
        bitCrusher.bits.value = 4;
        filter.frequency.value = 2000;
        distortion.distortion = 0.1;
        break;
      case "ambient":
        reverb.decay = 10;
        reverb.wet.value = 0.8;
        filter.frequency.value = 1500;
        synth.set({ envelope: { attack: 2, release: 5 } });
        break;
      case "synthwave":
        reverb.decay = 3;
        reverb.wet.value = 0.3;
        synth.set({ oscillator: { type: "sawtooth" }, envelope: { release: 1.5 } });
        break;
      case "trap":
        filter.frequency.value = 4000;
        synth.set({ envelope: { attack: 0.02, decay: 0.3, sustain: 0.1 } });
        break;
    }
    
    synth.connect(filter);
    synthRef.current = synth;

    if (notes.length > 0) {
      const part = new Tone.Part((time, note) => {
        synth.triggerAttackRelease(note.pitch, note.duration, time);
      }, notes.map(n => ({ time: n.time, pitch: n.pitch, duration: n.duration })));
      
      part.loop = true;
      part.loopEnd = Math.max(...notes.map(n => n.time + 1), 4);
      
      if (isPlaying) {
        part.start(0);
      }
      
      partRef.current = part;
    }

    return () => {
      synth.dispose();
      filter.dispose();
      bitCrusher.dispose();
      distortion.dispose();
      reverb.dispose();
      if (partRef.current) partRef.current.dispose();
    };
  }, [notes, instrument, role, preset, modIndex, modType, filterDepth]);

  const togglePlay = async () => {
    if (isPlaying) {
      if (partRef.current) partRef.current.stop();
      setIsPlaying(false);
      // We don't stop the global transport here because other layers might be playing
    } else {
      await Tone.start();
      if (partRef.current) partRef.current.start(0);
      if (Tone.getTransport().state !== "started") {
        Tone.getTransport().start();
      }
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

      {role === "lead" && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-black/40 border border-accent/20 rounded-xl"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-secondary uppercase tracking-widest">Mod Index</label>
              <span className="text-[10px] font-mono text-accent">{modIndex}</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="50" 
              step="0.5"
              value={modIndex}
              onChange={(e) => setModIndex(parseFloat(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono text-secondary uppercase tracking-widest">Mod Type</label>
            <select 
              value={modType}
              onChange={(e) => setModType(e.target.value as Tone.ToneOscillatorType)}
              className="w-full bg-black/60 border border-border/30 rounded-lg p-2 text-[10px] font-mono text-white uppercase"
            >
              <option value="sine">Sine</option>
              <option value="square">Square</option>
              <option value="sawtooth">Sawtooth</option>
              <option value="triangle">Triangle</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono text-secondary uppercase tracking-widest">Filter Depth</label>
              <span className="text-[10px] font-mono text-accent">{filterDepth} oct</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="7" 
              step="0.1"
              value={filterDepth}
              onChange={(e) => setFilterDepth(parseFloat(e.target.value))}
              className="w-full accent-accent"
            />
          </div>
        </motion.div>
      )}

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
