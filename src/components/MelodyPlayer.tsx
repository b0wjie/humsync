import React, { useState, useEffect, useRef } from "react";
import * as Tone from "tone";
import { Play, Pause, Download, Music, Sparkles, Loader2, Volume2, Settings2, Activity } from "lucide-react";
import { Note, generateFullTrack } from "@/services/gemini";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface MelodyPlayerProps {
  notes: Note[];
}

type SoundType = "Lead" | "Synth" | "Top Melody" | "Plucks" | "Pads" | "Bassline";

export const MelodyPlayer: React.FC<MelodyPlayerProps> = ({ notes }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingTrack, setIsGeneratingTrack] = useState(false);
  const [fullTrackUrl, setFullTrackUrl] = useState<string | null>(null);
  const [soundType, setSoundType] = useState<SoundType>("Lead");
  const [bpm, setBpm] = useState(120);
  const [error, setError] = useState<string | null>(null);
  
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);

  useEffect(() => {
    // Initialize synth with a default lead sound
    updateSynth("Lead");
    Tone.getTransport().bpm.value = bpm;
    
    return () => {
      synthRef.current?.dispose();
      partRef.current?.dispose();
      Tone.getTransport().stop();
    };
  }, []);

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  const updateSynth = (type: SoundType) => {
    synthRef.current?.dispose();
    
    let newSynth: Tone.PolySynth;
    
    switch (type) {
      case "Plucks":
        newSynth = new Tone.PolySynth(Tone.Synth, {
          envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 },
          oscillator: { type: "square" }
        });
        break;
      case "Pads":
        newSynth = new Tone.PolySynth(Tone.Synth, {
          envelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 1 },
          oscillator: { type: "sine" }
        });
        break;
      case "Bassline":
        newSynth = new Tone.PolySynth(Tone.Synth, {
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2 },
          oscillator: { type: "triangle" }
        });
        break;
      case "Lead":
      default:
        newSynth = new Tone.PolySynth(Tone.Synth, {
          envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 },
          oscillator: { type: "sawtooth" }
        });
        break;
    }
    
    synthRef.current = newSynth.toDestination();
    
    // Re-create part if notes exist
    if (notes.length > 0) {
      setupPart();
    }
  };

  const setupPart = () => {
    partRef.current?.dispose();
    
    partRef.current = new Tone.Part((time, note) => {
      synthRef.current?.triggerAttackRelease(note.pitch, note.duration, time);
    }, notes.map(n => ({ time: n.time, pitch: n.pitch, duration: n.duration })));
    
    partRef.current.loop = true;
    partRef.current.loopEnd = Math.max(...notes.map(n => n.time + 1));
    partRef.current.start(0); // CRITICAL: Start the part at time 0
  };

  useEffect(() => {
    if (notes.length > 0 && synthRef.current) {
      setupPart();
    }
  }, [notes]);

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
    // Check if API key is selected for Lyria models
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
      try {
        await window.aistudio.openSelectKey();
      } catch (err) {
        console.error("Key selection failed:", err);
        return;
      }
    }

    setIsGeneratingTrack(true);
    try {
      const prompt = `Create a professional ${soundType} music track at ${bpm} BPM based on this melody structure: ${JSON.stringify(notes)}. 
      The style should be modern and polished, specifically focusing on a ${soundType} sound character.`;
      const url = await generateFullTrack(prompt);
      if (!url) throw new Error("No audio was generated. Please try again.");
      setFullTrackUrl(url);
    } catch (err: any) {
      console.error("Enhancement failed:", err);
      
      let errorMessage = "Enhancement failed. Please try again.";
      
      // Handle specific 403 error
      if (err.message?.includes("403") || err.message?.includes("permission")) {
        errorMessage = "Permission Denied: Lyria models require a PAID Google Cloud API key. Please click Enhance again and ensure you select a key from a billing-enabled project.";
        // Reset key selection state to force a re-prompt on next click
        if (window.aistudio) await window.aistudio.openSelectKey();
      } else if (err.message?.includes("Requested entity was not found")) {
        errorMessage = "Model not found. Please ensure your API key has access to Lyria models.";
        if (window.aistudio) await window.aistudio.openSelectKey();
      }
      
      setError(errorMessage);
    } finally {
      setIsGeneratingTrack(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8 hardware-card w-full max-w-md mt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-mono uppercase tracking-widest">Melody Output</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-secondary">
          <Activity className="w-3 h-3" />
          {bpm} BPM
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-mono text-secondary flex items-center gap-1">
            <Settings2 className="w-3 h-3" /> Sound Type
          </label>
          <select 
            value={soundType}
            onChange={(e) => {
              const val = e.target.value as SoundType;
              setSoundType(val);
              updateSynth(val);
            }}
            className="bg-black border border-border rounded px-2 py-1 text-xs font-mono text-accent outline-none focus:border-accent"
          >
            {["Lead", "Synth", "Top Melody", "Plucks", "Pads", "Bassline"].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-mono text-secondary flex items-center gap-1">
            <Activity className="w-3 h-3" /> Tempo
          </label>
          <input 
            type="range" 
            min="60" 
            max="200" 
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className="accent-accent h-6"
          />
        </div>
      </div>

      <div className="lcd-display p-4 h-24 flex flex-col justify-center gap-2 overflow-hidden">
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {notes.map((note, i) => (
            <div 
              key={i} 
              className="flex-shrink-0 px-2 py-1 bg-accent/10 border border-accent/20 rounded text-[10px] font-mono"
            >
              {note.pitch}
            </div>
          ))}
        </div>
        <div className="text-[10px] opacity-50 font-mono flex justify-between">
          <span>{notes.length} NOTES DETECTED</span>
          <span>LOOP ACTIVE</span>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={togglePlay}
          className="flex-1 h-12 bg-accent hover:bg-accent/90 text-white rounded-lg flex items-center justify-center gap-2 font-bold transition-all active:scale-95 shadow-[0_0_15px_rgba(255,78,0,0.3)]"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          {isPlaying ? "PAUSE" : "PLAY MELODY"}
        </button>

        <button
          onClick={handleEnhance}
          disabled={isGeneratingTrack}
          className="flex-1 h-12 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50 group"
        >
          {isGeneratingTrack ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5 text-yellow-400 group-hover:scale-125 transition-transform" />
          )}
          ENHANCE
        </button>
      </div>

      {error && (
        <div className="text-[10px] font-mono text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-lg animate-in fade-in slide-in-from-top-1">
          {error}
        </div>
      )}

      {fullTrackUrl && (
        <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-accent">FULL TRACK READY</span>
            <a 
              href={fullTrackUrl} 
              download="humsync-melody.wav"
              className="text-secondary hover:text-white transition-colors"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
          <audio src={fullTrackUrl} controls className="w-full h-8 accent-accent" />
        </div>
      )}

      <div className="flex items-center gap-4 px-2">
        <Volume2 className="w-4 h-4 text-secondary" />
        <div className="flex-1 h-1 bg-border rounded-full relative">
          <div className="absolute left-0 top-0 h-full w-2/3 bg-accent rounded-full shadow-[0_0_5px_rgba(255,78,0,0.5)]" />
        </div>
      </div>
    </div>
  );
};

