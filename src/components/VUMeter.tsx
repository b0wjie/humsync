import React, { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { motion } from "motion/react";

interface VUMeterProps {
  meter: Tone.Meter | null;
  className?: string;
  orientation?: "horizontal" | "vertical";
}

export const VUMeter: React.FC<VUMeterProps> = ({ meter, className, orientation = "horizontal" }) => {
  const [level, setLevel] = useState(-Infinity);
  const requestRef = useRef<number | null>(null);

  const updateMeter = () => {
    if (meter) {
      const val = meter.getValue();
      if (Array.isArray(val)) {
        // Handle stereo meter if needed, but Tone.Meter is usually mono-summed or single channel depending on setup
        setLevel(val[0]);
      } else {
        setLevel(val as number);
      }
    }
    requestRef.current = requestAnimationFrame(updateMeter);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateMeter);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [meter]);

  // Convert dB to percentage (simplified for UI)
  // -60dB is basically silence, 0dB is reference peak
  const getPercentage = (db: number) => {
    if (db === -Infinity) return 0;
    const clamped = Math.max(-60, Math.min(6, db));
    return ((clamped + 60) / 66) * 100;
  };

  const percentage = getPercentage(level);

  return (
    <div className={className}>
      <div className={`relative bg-black/40 rounded-full overflow-hidden border border-white/5 ${orientation === 'horizontal' ? 'w-full h-1.5' : 'w-1.5 h-full'}`}>
        <motion.div
          className={`absolute bottom-0 left-0 transition-all duration-75 ${
            percentage > 90 ? "bg-red-500" : percentage > 75 ? "bg-yellow-400" : "bg-accent"
          }`}
          style={{
            [orientation === "horizontal" ? "width" : "height"]: `${percentage}%`,
            [orientation === "horizontal" ? "height" : "width"]: "100%",
          }}
          animate={{
             filter: percentage > 90 ? "brightness(1.5) drop-shadow(0 0 2px rgba(239, 68, 68, 0.5))" : "none"
          }}
        />
        {/* Indicators */}
        <div className={`absolute inset-0 flex ${orientation === "horizontal" ? "flex-row" : "flex-col-reverse"}`}>
          {[20, 40, 60, 80].map((tick) => (
            <div
              key={tick}
              className={`bg-white/10 ${orientation === "horizontal" ? "h-full w-px" : "w-full h-px"}`}
              style={{ [orientation === "horizontal" ? "left" : "bottom"]: `${tick}%`, position: "absolute" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
