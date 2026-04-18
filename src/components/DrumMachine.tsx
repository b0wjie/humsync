import React, { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";
import { Mic, Activity, Volume2, Music, Square, Play, Pause, Save, Trash2, VolumeX, Volume, Settings2, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { SOUND_LIBRARY } from "@/constants/samples";

interface DrumMachineProps {
  onAddLayer: (layer: any) => void;
  bpm: number;
}

const PADS = [
  { id: "p1", label: "Kick", note: "C1", color: "#f87171", defaultSample: "k-808" },
  { id: "p2", label: "Kick Deep", note: "C#1", color: "#f87171", defaultSample: "k-tech" },
  { id: "p3", label: "Snare", note: "D1", color: "#60a5fa", defaultSample: "s-808" },
  { id: "p4", label: "Snare Tech", note: "E1", color: "#60a5fa", defaultSample: "s-tech" },
  { id: "p5", label: "H-Cl", note: "F#1", color: "#fbbf24", defaultSample: "h-cl" },
  { id: "p6", label: "H-Op", note: "A#1", color: "#fbbf24", defaultSample: "h-op" },
  { id: "p7", label: "Clap", note: "D#1", color: "#a78bfa", defaultSample: "s-clap" },
  { id: "p8", label: "Cowbell", note: "G#1", color: "#34d399", defaultSample: "pc-cow" }
];

export const DrumMachine: React.FC<DrumMachineProps> = ({ onAddLayer, bpm }) => {
  const [activePad, setActivePad] = useState<string | null>(null);
  const [padSamples, setPadSamples] = useState<Record<string, string>>(
    PADS.reduce((acc, pad) => ({ ...acc, [pad.id]: pad.defaultSample }), {})
  );
  const [editingPad, setEditingPad] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState<{ pitch: string; time: number; duration: string; velocity: number }[]>([]);
  const [loopLength, setLoopLength] = useState<4 | 8 | 16>(4);
  const [progress, setProgress] = useState(0);
  const [metronomeOn, setMetronomeOn] = useState(false);

  const samplerRef = useRef<Tone.Sampler | null>(null);
  const startTimeRef = useRef<number>(0);
  const clickRef = useRef<Tone.MembraneSynth | null>(null);

  useEffect(() => {
    setIsLoaded(false);
    const urls: Record<string, string> = {};
    PADS.forEach(pad => {
      const sampleId = padSamples[pad.id];
      const sample = SOUND_LIBRARY.find(s => s.id === sampleId);
      if (sample) urls[pad.note] = sample.url;
    });

    const sampler = new Tone.Sampler({
      urls,
      onload: () => { 
        samplerRef.current = sampler.toDestination();
        setIsLoaded(true);
      }
    });
    
    clickRef.current = new Tone.MembraneSynth({ volume: -20 }).toDestination();

    return () => {
      sampler.dispose();
      clickRef.current?.dispose();
    };
  }, [padSamples]);

  // Loop progress and playback of recorded notes
  useEffect(() => {
    let sequence: Tone.Sequence | null = null;
    if (isPlaying && isLoaded && samplerRef.current) {
      sequence = new Tone.Sequence((time, step) => {
        Tone.Draw.schedule(() => {
          setProgress((step / (loopLength * 4)) * 100);
        }, time);
        
        // Play click if metronome is on
        if (metronomeOn && step % 4 === 0) {
          clickRef.current?.triggerAttackRelease("C2", "32n", time);
        }

        // Play recorded notes that match this step
        // We need to be more precise with quantization for playback
        const sixteenthNoteSeconds = 60 / bpm / 4;
        
        recordedNotes.forEach(note => {
          // Normalize quantized time to the loop
          const noteStep = Math.round(note.time / sixteenthNoteSeconds);
          if (noteStep % (loopLength * 4) === step) {
            samplerRef.current?.triggerAttack(note.pitch, time);
          }
        });
      }, Array.from({ length: loopLength * 4 }, (_, i) => i), "16n").start(0);

      if (Tone.getTransport().state !== "started") {
        Tone.getTransport().start();
      }
    } else {
      setProgress(0);
      // Don't stop transport here, just let the sequence cleanup handle it
    }
    return () => { 
      sequence?.dispose(); 
    };
  }, [isPlaying, isLoaded, loopLength, bpm, recordedNotes, metronomeOn]);

  const triggerPad = async (id: string, note: string) => {
    if (Tone.context.state !== "running") await Tone.start();
    if (!samplerRef.current) return;
    
    samplerRef.current.triggerAttack(note);
    setActivePad(id);
    setTimeout(() => setActivePad(null), 100);

    if (isRecording && isPlaying) {
      const transportTime = Tone.getTransport().seconds;
      const relativeTime = (transportTime - startTimeRef.current) % (loopLength * (60 / bpm));
      
      const sixteenthNoteTime = (60 / bpm) / 4;
      const quantizedTime = Math.round(relativeTime / sixteenthNoteTime) * sixteenthNoteTime;

      setRecordedNotes(prev => [...prev, {
        pitch: note,
        time: quantizedTime,
        duration: "16n",
        velocity: 0.8
      }]);
    }
  };

  const togglePlayback = async () => {
    if (Tone.context.state !== "running") await Tone.start();
    if (isPlaying) {
      setIsPlaying(false);
      setIsRecording(false);
    } else {
      startTimeRef.current = Tone.getTransport().seconds;
      setIsPlaying(true);
    }
  };

  const saveLayer = () => {
    if (recordedNotes.length === 0) return;
    onAddLayer({
      id: Math.random().toString(36).substr(2, 9),
      role: "foundation",
      instrument: "Custom Drum Performance",
      frequencyZone: "Bass",
      audioUrl: "", 
      geminiDescription: `Finger-drummed ${loopLength}-beat loop with custom sample mapping.`,
      spectrumCoverage: [20, 800],
      notes: recordedNotes
    });
    setRecordedNotes([]);
    setIsPlaying(false);
  };

  const filteredSamples = SOUND_LIBRARY.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="hardware-card p-6 flex flex-col gap-6 bg-black/60 border border-border/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative">
      <AnimatePresence>
        {editingPad && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="absolute inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">Sample Browser</h4>
                  <p className="text-[8px] font-mono text-secondary uppercase">Assigning to {PADS.find(p => p.id === editingPad)?.label}</p>
                </div>
                <button onClick={() => setEditingPad(null)} className="p-1 text-secondary hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 border-b border-white/5 relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-3 h-3 text-secondary" />
                <input 
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="SEARCH SAMPLES..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-[10px] font-mono uppercase text-white outline-none focus:border-accent/40"
                />
              </div>

              <div className="flex-1 overflow-y-auto max-h-[300px] p-2 custom-scrollbar">
                <div className="grid grid-cols-1 gap-1">
                  {filteredSamples.map(sample => (
                    <button
                      key={sample.id}
                      onClick={() => {
                        setPadSamples(prev => ({ ...prev, [editingPad]: sample.id }));
                        setEditingPad(null);
                        setSearchTerm("");
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl transition-all group/item",
                        padSamples[editingPad] === sample.id 
                          ? "bg-accent/10 border border-accent/40 text-accent" 
                          : "bg-white/5 hover:bg-white/10 text-secondary hover:text-white"
                      )}
                    >
                      <div className="flex flex-col items-start px-2">
                        <span className="text-[10px] font-black uppercase tracking-widest">{sample.name}</span>
                        <span className="text-[7px] font-mono opacity-40 uppercase">{sample.category}</span>
                      </div>
                      {padSamples[editingPad] === sample.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-accent mr-2 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white/90 italic">Drum Designer</h3>
            <p className="text-[8px] font-mono text-secondary uppercase tracking-tighter">
              {samplerRef.current ? "Custom Kit Loaded // Live Dub" : "SYNCHING SAMPLES..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMetronomeOn(!metronomeOn)}
            className={cn(
              "p-2 rounded-lg transition-all border",
              metronomeOn ? "bg-accent/20 text-accent border-accent/40 shadow-[0_0_10px_rgba(59,130,246,0.3)]" : "bg-white/5 text-white/40 border-white/10"
            )}
            title="Metronome"
          >
            {metronomeOn ? <Volume className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

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
              "p-2.5 rounded-full transition-all border shadow-lg",
              isPlaying ? "bg-red-500 text-white border-red-400 rotate-animation" : "bg-accent text-white border-accent-glow"
            )}
          >
            {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5 fill-current" />}
          </button>
        </div>
      </div>

      {/* Progress Tracker */}
      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-border/10 inner-shadow">
        <motion.div 
          className="h-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-[8px] font-mono text-secondary uppercase tracking-widest leading-none mb-1">Performance Mode</span>
          <span className="text-[10px] font-black text-white/90 uppercase tracking-tighter">Custom Loop Synth</span>
        </div>

        <button
          onClick={() => setIsRecording(!isRecording)}
          disabled={!isPlaying}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all border",
            isRecording 
              ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse" 
              : "bg-white/5 text-white hover:bg-white/10 border-white/20 disabled:opacity-20"
          )}
        >
          <div className={cn("w-2 h-2 rounded-full", isRecording ? "bg-white" : "bg-red-500")} />
          {isRecording ? "RECORDING" : "OVERDUB"}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 perspective-container">
        {PADS.map((pad) => {
          const sample = SOUND_LIBRARY.find(s => s.id === padSamples[pad.id]);
          return (
            <div key={pad.id} className="relative group">
              <motion.button
                whileHover={{ scale: 1.05, translateY: -4 }}
                whileTap={{ scale: 0.95, translateY: 2 }}
                onMouseDown={() => triggerPad(pad.id, pad.note)}
                className={cn(
                  "aspect-square w-full rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 relative overflow-hidden group/pad tilt-card shadow-lg",
                  activePad === pad.id 
                    ? "bg-white/10 border-white" 
                    : "bg-black/40 border-[#2a2d33] hover:border-border/60"
                )}
                style={{ 
                  borderColor: activePad === pad.id ? pad.color : undefined,
                  boxShadow: activePad === pad.id ? `0 0 30px ${pad.color}66, inset 0 0 10px ${pad.color}44` : undefined
                }}
              >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
                <div className={cn(
                  "text-[9px] font-black uppercase tracking-widest relative z-10 transition-colors text-center px-1 leading-tight",
                  activePad === pad.id ? "text-white" : "text-secondary/60"
                )}>
                  {sample?.name || pad.label}
                </div>
                <div 
                  className="w-1.5 h-1.5 rounded-full relative z-10" 
                  style={{ 
                    backgroundColor: pad.color,
                    boxShadow: activePad === pad.id ? `0 0 10px ${pad.color}` : 'none',
                    opacity: activePad === pad.id ? 1 : 0.4
                  }} 
                />
              </motion.button>
              
              <button 
                onClick={() => setEditingPad(pad.id)}
                className="absolute top-1 right-1 p-1 bg-black/60 rounded-md border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-accent/20 hover:border-accent/30"
              >
                <Settings2 className="w-2.5 h-2.5 text-secondary hover:text-accent" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border/20 pt-4">
        <div className="flex flex-col">
          <span className="text-[8px] font-mono text-secondary uppercase tracking-widest">Recorded Hits</span>
          <span className="text-xs font-black text-white/80">{recordedNotes.length}</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setRecordedNotes([])}
            className="flex items-center gap-2 text-[8px] font-mono text-secondary hover:text-red-400 transition-colors uppercase tracking-widest"
          >
            <Trash2 className="w-3 h-3" /> Reset
          </button>
          <button 
            onClick={saveLayer}
            disabled={recordedNotes.length === 0}
            className="flex items-center gap-2 px-6 py-2 bg-accent/20 text-accent border border-accent/40 rounded-lg text-[10px] font-black uppercase tracking-[0.4em] hover:bg-accent/30 transition-all shadow-lg active:scale-95 disabled:opacity-20"
          >
            <Save className="w-4 h-4" /> Save Performance
          </button>
        </div>
      </div>
    </div>
  );
};
