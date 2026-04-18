import React from "react";
import { SPECTRUM_ZONES } from "@/services/gemini";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface StackVisualizerProps {
  spectrumMap: { [zone: string]: boolean };
  coverageScore: number;
}

export const StackVisualizer: React.FC<StackVisualizerProps> = ({ spectrumMap, coverageScore }) => {
  return (
    <div className="w-full hardware-card p-6 flex flex-col gap-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent-glow)]" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Spectrum Coverage</h3>
        </div>
        <div className="lcd-display py-1 px-3 min-w-[100px] text-center">
          <span className="text-accent font-mono text-[10px] tracking-widest uppercase">
            {coverageScore.toString().padStart(2, '0')} / 07 ACTIVE
          </span>
        </div>
      </div>

      <div className="flex gap-2 h-20 items-stretch relative z-10">
        {SPECTRUM_ZONES.map((zone) => {
          const isFilled = spectrumMap[zone.name];
          return (
            <div key={zone.name} className="flex-1 flex flex-col gap-3 group/zone">
              <div className="relative flex-1 w-full bg-[#0d1117] rounded-sm overflow-hidden border border-[#1e293b] shadow-inner">
                {/* Visualizer Mesh */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:100%_4px] opacity-50" />
                
                <AnimatePresence>
                  {isFilled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "100%" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="absolute bottom-0 left-0 w-full hardware-glow"
                      style={{ 
                        background: `linear-gradient(to top, ${zone.color}, ${zone.color}cc)`,
                        boxShadow: `0 0 15px ${zone.color}44`
                      }}
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.4))] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" />
                      <div className="absolute top-0 left-0 w-full h-[1px] bg-white/40" />
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {!isFilled && (
                  <div className="absolute bottom-1 left-1 opacity-20 text-[6px] font-mono uppercase rotate-90 origin-left translate-x-1 underline decoration-accent/20">
                    Muted
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className={cn(
                  "text-[7px] font-mono uppercase tracking-tighter transition-all",
                  isFilled ? "text-accent font-bold" : "text-secondary/30"
                )}>
                  {zone.name.toUpperCase()}
                </span>
                <div className={cn(
                  "w-1 h-1 rounded-full transition-all",
                  isFilled ? "bg-accent shadow-[0_0_5px_var(--accent-glow)]" : "bg-[#1e293b]"
                )} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
