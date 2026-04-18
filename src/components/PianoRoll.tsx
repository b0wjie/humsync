import React, { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { motion, AnimatePresence } from "motion/react";
import { Music, Square, Play, Pause, Save, Trash2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface PianoRollProps {
  onAddLayer: (layer: any) => void;
  bpm: number;
}

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const OCTAVES = [2, 3, 4];

export const PianoRoll: React.FC<PianoRollProps> = ({ onAddLayer, bpm }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState<{ pitch: string; time: number; duration: string; velocity: number }[]>([]);
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [loopLength, setLoopLength] = useState<4 | 8 | 16>(4); // beats
  const [progress, setProgress] = useState(0);

  const synthRef = useRef<Tone.PolySynth | null>(null);
  const startTimeRef = useRef<number>(0);

  // Synth init
  useEffect(() => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.5 }
    }).toDestination();
    synthRef.current = synth;
    return () => {
      synth.dispose();
    };
  }, []);

  // Loop progress tracker
  useEffect(() => {
    let animationId: number;
    const updateProgress = () => {
      if (isPlaying) {
        const transportTime = Tone.getTransport().seconds;
        const relativeTime = (transportTime - startTimeRef.current) % (loopLength * (60 / bpm));
        const p = (relativeTime / (loopLength * (60 / bpm))) * 100;
        setProgress(p);
      } else {
        setProgress(0);
      }
      animationId = requestAnimationFrame(updateProgress);
    };
    updateProgress();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, loopLength, bpm]);

  const togglePlayback = async () => {
    if (Tone.context.state !== "running") {
      await Tone.start();
    }

    if (isPlaying) {
      Tone.getTransport().stop();
      setIsPlaying(false);
      setIsRecording(false);
    } else {
      startTimeRef.current = Tone.getTransport().seconds;
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  };

  const playNote = (note: string) => {
    if (!synthRef.current) return;
    synthRef.current.triggerAttack(note);
    setActiveNotes(prev => new Set(prev).add(note));

    if (isRecording) {
      const transportTime = Tone.getTransport().seconds;
      const relativeTime = (transportTime - startTimeRef.current) % (loopLength * (60 / bpm));
      
      // Basic quantization to 16n
      const quarterNoteLength = 60 / bpm;
      const sixteenthNoteLength = quarterNoteLength / 4;
      const quantizedTime = Math.round(relativeTime / sixteenthNoteLength) * sixteenthNoteLength;

      setRecordedNotes(prev => [...prev, {
        pitch: note,
        time: quantizedTime,
        duration: "16n",
        velocity: 0.8
      }]);
    }
  };

  const stopNote = (note: string) => {
    if (!synthRef.current) return;
    synthRef.current.triggerRelease(note);
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  };

  const clearRecording = () => {
    setRecordedNotes([]);
  };

  const saveLayer = () => {
    if (recordedNotes.length === 0) return;

    onAddLayer({
      id: Math.random().toString(36).substring(2, 9),
      role: "lead",
      instrument: "PolySynth Lead",
      frequencyZone: "Mid",
      audioUrl: "",
      geminiDescription: `Live-tapped ${loopLength}-beat melodic loop using PolySynth.`,
      spectrumCoverage: [400, 3000],
      notes: recordedNotes
    });
    
    setIsPlaying(false);
    setIsRecording(false);
    clearRecording();
  };

  return (
    <div className="hardware-card p-6 flex flex-col gap-6 bg-black/60 border border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-500 border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white/90 italic">Melody Overdub</h3>
            <p className="text-[8px] font-mono text-secondary uppercase tracking-tighter">Live Tapping Rec // {loopLength} Beats</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-black/40 rounded-lg p-1 border border-border/20">
            {[4, 8, 16].map(len => (
              <button
                key={len}
                onClick={() => setLoopLength(len as any)}
                className={cn(
                  "px-3 py-1 text-[8px] font-mono rounded transition-all",
                  loopLength === len ? "bg-accent text-white shadow-lg" : "text-secondary hover:text-white"
                )}
              >
                {len}B
              </button>
            ))}
          </div>
          
          <button
            onClick={togglePlayback}
            className={cn(
              "p-2 rounded-full transition-all border",
              isPlaying ? "bg-red-500/10 text-red-500 border-red-500/30" : "bg-white/5 text-white border-white/10"
            )}
          >
            {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          
          <button
            onClick={() => setIsRecording(!isRecording)}
            disabled={!isPlaying}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
              isRecording 
                ? "bg-red-500 text-white animate-pulse" 
                : "bg-white/5 text-white hover:bg-white/10 border-white/10 disabled:opacity-20"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", isRecording ? "bg-white" : "bg-red-500")} />
            {isRecording ? "DUBBING" : "OVERDUB"}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-border/10 inner-shadow">
        <motion.div 
          className="h-full bg-accent shadow-[0_0_10px_var(--accent-glow)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Keyboard Container */}
      <div className="relative h-48 bg-[#0a0a0a] rounded-xl border border-border/30 overflow-hidden shadow-inner group">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none" />
        
        <div className="flex h-full p-4 gap-1.5 overflow-x-auto custom-scrollbar">
          {OCTAVES.map(octave => 
            NOTES.map(noteName => {
              const fullNote = `${noteName}${octave}`;
              const isBlack = noteName.includes("#");
              return (
                <motion.button
                  key={fullNote}
                  onMouseDown={() => playNote(fullNote)}
                  onMouseUp={() => stopNote(fullNote)}
                  onMouseLeave={() => stopNote(fullNote)}
                  animate={{
                    backgroundColor: activeNotes.has(fullNote) 
                      ? (isBlack ? "#f97316" : "rgba(249, 115, 22, 0.3)")
                      : (isBlack ? "#000" : "#fff"),
                    scale: activeNotes.has(fullNote) ? 0.98 : 1,
                  }}
                  className={cn(
                    "flex-shrink-0 transition-all rounded-b-lg border-x border-b relative",
                    isBlack 
                      ? "w-8 h-2/3 border-border/60 z-10 -mx-4 shadow-xl" 
                      : "w-12 h-full border-gray-200 z-0",
                    activeNotes.has(fullNote) && (isBlack ? "brightness-150 shadow-[0_0_20px_rgba(249,115,22,0.6)]" : "border-accent shadow-[0_0_15px_rgba(249,115,22,0.3)]")
                  )}
                >
                  <span className={cn(
                    "text-[8px] font-mono absolute bottom-2 left-1/2 -translate-x-1/2 uppercase tracking-tighter opacity-30",
                    isBlack ? "text-white" : "text-black"
                  )}>
                    {fullNote}
                  </span>
                </motion.button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer / Stats */}
      <div className="flex items-center justify-between border-t border-border/20 pt-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[8px] font-mono text-secondary uppercase tracking-[0.2em]">Recorded Notes</span>
            <span className="text-xs font-black text-white/80">{recordedNotes.length}</span>
          </div>
          <button 
            onClick={clearRecording}
            className="flex items-center gap-2 text-[8px] font-mono text-secondary hover:text-red-400 transition-colors uppercase tracking-[0.2em]"
          >
            <Trash2 className="w-3 h-3" /> Reset
          </button>
        </div>
        
        <button 
          onClick={saveLayer}
          disabled={recordedNotes.length === 0}
          className="flex items-center gap-2 px-6 py-2 bg-accent/20 text-accent border border-accent/30 rounded-lg text-[10px] font-black uppercase tracking-[0.34em] hover:bg-accent/30 transition-all disabled:opacity-20"
        >
          <Save className="w-4 h-4" /> Save Melody
        </button>
      </div>
    </div>
  );
};
