import React, { useState, useEffect, useCallback, useRef } from "react";
import * as Tone from "tone";
import { Play, Pause, Trash2, Save, Music, Square, Plus, X, ChevronRight, Sliders, Volume2, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { SOUND_LIBRARY } from "@/constants/samples";

interface Track {
  id: string;
  label: string;
  color: string;
  sampleId: string;
  volume: number; // in dB
  pan: number; // -1 to 1
  isMuted: boolean;
  isSoloed: boolean;
}

interface StepSequencerProps {
  onAddLayer: (layer: any) => void;
  bpm: number;
}

const STEPS = 16;
const NOTE_MAPPING = ["C2", "D2", "E2", "F2", "G2", "A2", "B2", "C3", "D3", "E3"];

export const StepSequencer: React.FC<StepSequencerProps> = ({ onAddLayer, bpm }) => {
  const [tracks, setTracks] = useState<Track[]>([
    { id: "t1", label: "Kick", color: "#ef4444", sampleId: "k-808", volume: 0, pan: 0, isMuted: false, isSoloed: false },
    { id: "t2", label: "Snare", color: "#3b82f6", sampleId: "s-808", volume: -3, pan: 0, isMuted: false, isSoloed: false },
    { id: "t3", label: "Hi-Hat", color: "#eab308", sampleId: "h-cl", volume: -6, pan: 0, isMuted: false, isSoloed: false },
    { id: "t4", label: "Perc", color: "#a855f7", sampleId: "pc-cow", volume: -8, pan: 0.2, isMuted: false, isSoloed: false },
  ]);
  
  const [grid, setGrid] = useState<boolean[][]>(
    tracks.map(() => new Array(STEPS).fill(false))
  );
  
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState<string | null>(null);

  const samplerRef = useRef<Tone.Sampler | null>(null);
  const volumeNodesRef = useRef<{ [id: string]: Tone.Volume }>({});
  const pannerNodesRef = useRef<{ [id: string]: Tone.Panner }>({});
  const sequenceRef = useRef<Tone.Sequence | null>(null);

  useEffect(() => {
    setIsLoaded(false);
    const urls: Record<string, string> = {};
    tracks.forEach((t, i) => {
      const sample = SOUND_LIBRARY.find(s => s.id === t.sampleId);
      if (sample) urls[NOTE_MAPPING[i]] = sample.url;
    });

    const sampler = new Tone.Sampler({
      urls,
      onload: () => {
        setIsLoaded(true);
      }
    });

    samplerRef.current = sampler;

    tracks.forEach(track => {
      if (!volumeNodesRef.current[track.id]) {
        const vol = new Tone.Volume(track.volume).toDestination();
        const pan = new Tone.Panner(track.pan).connect(vol);
        volumeNodesRef.current[track.id] = vol;
        pannerNodesRef.current[track.id] = pan;
      } else {
        volumeNodesRef.current[track.id].volume.value = track.volume;
        pannerNodesRef.current[track.id].pan.value = track.pan;
      }
    });

    return () => {
      sampler.dispose();
      Object.values(volumeNodesRef.current).forEach(v => v.dispose());
      Object.values(pannerNodesRef.current).forEach(p => p.dispose());
      volumeNodesRef.current = {};
      pannerNodesRef.current = {};
    };
  }, [tracks.map(t => t.sampleId).join(",")]);

  useEffect(() => {
    tracks.forEach(track => {
      if (volumeNodesRef.current[track.id]) {
        volumeNodesRef.current[track.id].volume.value = track.isMuted ? -Infinity : track.volume;
        pannerNodesRef.current[track.id].pan.value = track.pan;
      }
    });
  }, [tracks]);

  useEffect(() => {
    if (isPlaying && isLoaded && samplerRef.current) {
      sequenceRef.current = new Tone.Sequence(
        (time, step) => {
          Tone.Draw.schedule(() => {
            setCurrentStep(step);
          }, time);

          const soloedTracks = tracks.filter(t => t.isSoloed);
          const hasSolo = soloedTracks.length > 0;

          tracks.forEach((track, i) => {
            if (grid[i][step]) {
              const shouldPlay = hasSolo ? track.isSoloed : !track.isMuted;
              if (shouldPlay && samplerRef.current) {
                const panner = pannerNodesRef.current[track.id];
                if (panner) {
                  samplerRef.current.connect(panner);
                  samplerRef.current.triggerAttack(NOTE_MAPPING[i], time);
                } else {
                  samplerRef.current.triggerAttack(NOTE_MAPPING[i], time);
                }
              }
            }
          });
        },
        Array.from({ length: STEPS }, (_, i) => i),
        "16n"
      ).start(0);

      Tone.getTransport().start();
    } else {
      sequenceRef.current?.dispose();
      setCurrentStep(-1);
    }

    return () => {
      sequenceRef.current?.dispose();
    };
  }, [isPlaying, isLoaded, grid, tracks]);

  const handleTogglePlay = async () => {
    if (Tone.context.state !== "running") await Tone.start();
    if (isPlaying) {
      setIsPlaying(false);
      Tone.getTransport().pause();
    } else {
      setIsPlaying(true);
      Tone.getTransport().start();
    }
  };

  const toggleStep = async (trackIdx: number, stepIdx: number) => {
    if (Tone.context.state !== "running") await Tone.start();
    const newGrid = [...grid];
    newGrid[trackIdx] = [...newGrid[trackIdx]];
    newGrid[trackIdx][stepIdx] = !newGrid[trackIdx][stepIdx];
    setGrid(newGrid);
  };

  const updateTrack = (id: string, updates: Partial<Track>) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const addTrack = () => {
    if (tracks.length >= 10) return;
    const colors = ["#ef4444", "#3b82f6", "#eab308", "#a855f7", "#34d399", "#f472b6", "#fb923c", "#38bdf8"];
    const id = Math.random().toString(36).substr(2, 9);
    const newTrack: Track = {
      id,
      label: "New Sound",
      color: colors[tracks.length % colors.length],
      sampleId: "pc-cow",
      volume: 0,
      pan: 0,
      isMuted: false,
      isSoloed: false
    };
    setTracks(prev => [...prev, newTrack]);
    setGrid(prev => [...prev, new Array(STEPS).fill(false)]);
  };

  const removeTrack = (id: string) => {
    if (tracks.length <= 1) return;
    const idx = tracks.findIndex(t => t.id === id);
    setTracks(prev => prev.filter(t => t.id !== id));
    setGrid(prev => prev.filter((_, i) => i !== idx));
  };

  const clearGrid = () => {
    setGrid(tracks.map(() => new Array(STEPS).fill(false)));
  };

  const saveToStack = () => {
    const notes: any[] = [];
    grid.forEach((track, trackIdx) => {
      track.forEach((active, stepIdx) => {
        if (active) {
          notes.push({
            pitch: NOTE_MAPPING[trackIdx],
            duration: "16n",
            time: stepIdx * 0.25,
            velocity: 0.8
          });
        }
      });
    });

    onAddLayer({
      id: Math.random().toString(36).substr(2, 9),
      role: "foundation",
      instrument: "FL-Style Sequence",
      frequencyZone: "Mid",
      audioUrl: "",
      geminiDescription: `Rhythmic grid with ${tracks.length} channels.`,
      spectrumCoverage: [60, 15000],
      notes: notes
    });
    
    setIsPlaying(false);
    Tone.getTransport().stop();
  };

  return (
    <div className="hardware-card p-4 flex flex-col gap-4 bg-[#1a1c20] border-t-2 border-white/5 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-2 py-2 bg-black/40 rounded-xl border border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_var(--accent-glow)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] italic text-white/90">Channel Rack</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-3">
             <button 
               onClick={handleTogglePlay}
               className={cn(
                 "p-2 rounded-lg transition-all",
                 isPlaying ? "bg-red-500/20 text-red-500 border border-red-500/40" : "bg-accent/10 text-accent border border-accent/30"
               )}
             >
               {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
             </button>
             <div className="flex flex-col">
               <span className="text-[7px] font-mono text-secondary uppercase leading-none">Status</span>
               <span className="text-[9px] font-black uppercase text-accent">
                 {isLoaded ? "SYNC_OK" : "LOADING_SAMPLES..."}
               </span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={addTrack}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Plus className="w-3 h-3" /> Insert
          </button>
          <button 
            onClick={saveToStack}
            className="px-3 py-1.5 rounded-lg bg-accent text-white text-[8px] font-black uppercase tracking-[0.2em] shadow-lg shadow-accent/20"
          >
            Send to Playlist
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
        {tracks.map((track, i) => (
          <div key={track.id} className="flex items-center gap-4 p-1 rounded-lg group hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-2 w-48 shrink-0">
               <div className="flex flex-col gap-1 shrink-0">
                 <button 
                   onClick={() => updateTrack(track.id, { isSoloed: !track.isSoloed })}
                   className={cn(
                     "w-4 h-4 rounded-sm flex items-center justify-center text-[7px] font-bold border transition-all",
                     track.isSoloed ? "bg-yellow-500 text-black border-yellow-400" : "bg-black/40 text-secondary border-white/5"
                   )}
                 > S </button>
                 <button 
                   onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
                   className={cn(
                     "w-4 h-4 rounded-sm flex items-center justify-center text-[7px] font-bold border transition-all",
                     track.isMuted ? "bg-red-500 text-white border-red-400" : "bg-black/40 text-secondary border-white/5"
                   )}
                 > M </button>
               </div>

               <div className="flex flex-col gap-1 shrink-0 ml-1">
                 <div className="flex items-center gap-2">
                   <input 
                     type="range" min="-1" max="1" step="0.1" value={track.pan}
                     onChange={(e) => updateTrack(track.id, { pan: parseFloat(e.target.value) })}
                     className="w-8 h-1 accent-white/20 appearance-none bg-black/40 rounded-full"
                     title="Pan"
                   />
                 </div>
                 <div className="flex items-center gap-2">
                    <input 
                      type="range" min="-30" max="6" step="1" value={track.volume}
                      onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })}
                      className="w-12 h-1 accent-accent appearance-none bg-black/40 rounded-full"
                      title="Volume"
                    />
                 </div>
               </div>

               <div className="flex flex-col min-w-0 flex-1 ml-2 relative">
                 <button 
                    onClick={() => setIsMenuOpen(isMenuOpen === track.id ? null : track.id)}
                    className="flex flex-col items-start truncate group/label"
                 >
                   <span className="text-[10px] font-black uppercase text-white/80 group-hover/label:text-white transition-colors truncate w-full">
                     {track.label}
                   </span>
                   <span className="text-[6px] font-mono text-secondary uppercase tracking-widest leading-none">
                     CH-{String(i + 1).padStart(2, '0')}
                   </span>
                 </button>

                 <AnimatePresence>
                   {isMenuOpen === track.id && (
                     <motion.div 
                       initial={{ opacity: 0, scale: 0.95, y: -10 }}
                       animate={{ opacity: 1, scale: 1, y: 0 }}
                       exit={{ opacity: 0, scale: 0.95, y: -10 }}
                       className="absolute left-0 top-full mt-2 z-[100] w-48 bg-[#121418] border border-white/10 rounded-xl shadow-2xl p-2 max-h-48 overflow-y-auto"
                     >
                       <div className="mb-2 px-2 py-1 text-[7px] font-black uppercase tracking-[0.2em] text-accent border-b border-white/5">Sound Selection</div>
                       {SOUND_LIBRARY.map(sample => (
                         <button
                           key={sample.id}
                           onClick={() => {
                             const s = SOUND_LIBRARY.find(item => item.id === sample.id);
                             updateTrack(track.id, { label: s?.name, sampleId: sample.id });
                             setIsMenuOpen(null);
                           }}
                           className="w-full text-left px-3 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest hover:bg-white/5 transition-colors flex items-center justify-between"
                         >
                           <span className={cn(sample.id === track.sampleId ? "text-accent" : "text-white/60")}>{sample.name}</span>
                           <span className="text-[6px] opacity-20 uppercase">{sample.category}</span>
                         </button>
                       ))}
                     </motion.div>
                   )}
                 </AnimatePresence>
               </div>
               
               <button 
                 onClick={() => removeTrack(track.id)}
                 className="opacity-0 group-hover:opacity-100 p-1 text-white/20 hover:text-red-500 transition-all ml-1"
               >
                 <X className="w-3 h-3" />
               </button>
            </div>

            <div className="flex gap-1 overflow-x-auto">
              {grid[i].map((active, j) => {
                const isGroupOf4 = Math.floor(j / 4) % 2 === 0;
                return (
                  <motion.button
                    key={j}
                    onClick={() => toggleStep(i, j)}
                    whileTap={{ scale: 0.9 }}
                    className={cn(
                      "w-6 h-8 rounded-[2px] border transition-all relative",
                      active 
                        ? "shadow-[0_0_15px_rgba(255,255,255,0.1)]" 
                        : isGroupOf4 ? "bg-[#2d3036] border-[#3a3d44]" : "bg-[#24272c] border-[#2f3239]",
                      currentStep === j ? "after:content-[''] after:absolute after:inset-0 after:bg-white/10" : ""
                    )}
                    style={{
                      backgroundColor: active ? track.color : undefined,
                      borderColor: active ? `${track.color}aa` : undefined,
                      boxShadow: active ? `0 0 15px ${track.color}44, inset 0 0 5px rgba(255,255,255,0.2)` : undefined
                    }}
                  >
                    {currentStep === j && (
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-white glow-shadow" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-auto px-2 py-2 border-t border-white/5">
        <div className="flex items-center gap-6">
          <button 
            onClick={clearGrid}
            className="text-[8px] font-mono text-secondary hover:text-white transition-colors uppercase tracking-[0.2em] flex items-center gap-2"
          >
            <Trash2 className="w-3 h-3" /> Init Sequence
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[7px] font-mono text-secondary uppercase leading-none">Loop Engine</span>
            <span className="text-[9px] font-black uppercase text-white/80">16-Step Pattern 01</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
            <Sliders className="w-4 h-4 text-secondary opacity-40" />
          </div>
        </div>
      </div>
    </div>
  );
};
