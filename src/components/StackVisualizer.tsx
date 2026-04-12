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
    <div className="w-full hardware-card p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-secondary">Spectrum Analysis</h3>
        <div className="text-accent font-mono text-xs">
          {coverageScore}/7 ZONES FILLED
        </div>
      </div>

      <div className="flex gap-1 h-12 items-end">
        {SPECTRUM_ZONES.map((zone) => {
          const isFilled = spectrumMap[zone.name];
          return (
            <div key={zone.name} className="flex-1 flex flex-col gap-2">
              <div className="relative h-full w-full bg-black/40 rounded-sm overflow-hidden border border-border/50">
                <AnimatePresence>
                  {isFilled && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "100%" }}
                      exit={{ height: 0 }}
                      className="absolute bottom-0 left-0 w-full"
                      style={{ backgroundColor: zone.color }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <span className={cn(
                "text-[8px] font-mono uppercase text-center truncate",
                isFilled ? "text-white" : "text-secondary/40"
              )}>
                {zone.name.split('-')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
