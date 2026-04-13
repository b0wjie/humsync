import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, Play, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  onError?: (message: string) => void;
  isProcessing: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, onError, isProcessing }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(30).fill(2));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        onRecordingComplete(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      // Visualizer setup
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 64;
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVisualizer = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Normalize and update levels
        const levels = Array.from(dataArray).slice(0, 30).map(v => Math.max(2, (v / 255) * 40));
        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(updateVisualizer);
      };

      updateVisualizer();
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      onError?.("Microphone access failed. Allow microphone permission in the browser and try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 hardware-card w-full max-w-md">
      <div className="lcd-display w-full p-4 flex flex-col items-center gap-2 h-32 justify-center relative overflow-hidden">
        <div className="absolute top-2 left-2 text-[10px] opacity-50 uppercase tracking-widest font-mono">
          Input Monitor
        </div>
        
        <div className="flex items-end gap-1 h-12">
          {audioLevels.map((level, i) => (
            <motion.div
              key={i}
              className="waveform-bar"
              animate={{ height: isRecording ? level : 2 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />
          ))}
        </div>

        <div className="text-2xl font-mono mt-2">
          {isProcessing ? "ANALYZING..." : isRecording ? formatTime(recordingTime) : "READY"}
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="knob rotate-[-45deg]" />
          <span className="text-[10px] text-secondary uppercase tracking-tighter">Gain</span>
        </div>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 border-4",
            isRecording 
              ? "bg-red-500/20 border-red-500 recording-glow text-red-500" 
              : "bg-accent/20 border-accent text-accent hover:bg-accent/30",
            isProcessing && "opacity-50 cursor-not-allowed"
          )}
        >
          {isProcessing ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : isRecording ? (
            <Square className="w-8 h-8 fill-current" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </button>

        <div className="flex flex-col items-center gap-2">
          <div className="knob rotate-[45deg]" />
          <span className="text-[10px] text-secondary uppercase tracking-tighter">Comp</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs text-secondary italic">
          {isProcessing 
            ? "Gemini is transcribing your melody..." 
            : isRecording 
              ? "Hum your melody clearly..." 
              : "Press the button and hum your idea"}
        </p>
      </div>
    </div>
  );
};
