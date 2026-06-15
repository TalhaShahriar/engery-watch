import React from "react";
import { Zap } from "lucide-react";

interface GaugeProps {
  watts: number;
  maxLimit?: number;
}

export default function EnergyGauge({ watts, maxLimit = 3000 }: GaugeProps) {
  // SVG constants
  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Semicircular angle (180deg = PI * r), let's offset it slightly (e.g. 240 degrees sweep)
  const angleStart = -120; // in degrees
  const angleEnd = 120; // in degrees
  const angleSweep = angleEnd - angleStart; // 240 degrees
  
  const arcLength = (angleSweep / 360) * circumference;
  
  // Percentage of max wattage
  const percent = Math.min(watts / maxLimit, 1);
  const strokeDashoffset = arcLength - percent * arcLength;

  // Visual dial coordinates
  const cx = size / 2;
  const cy = size / 2;

  // Let's draw arc path manually for the speedometer
  const startAngleRad = (Math.PI / 180) * (90 - angleStart);
  const endAngleRad = (Math.PI / 180) * (90 - angleEnd);
  
  const x1 = cx + radius * Math.cos(startAngleRad);
  const y1 = cy - radius * Math.sin(startAngleRad);
  const x2 = cx + radius * Math.cos(endAngleRad);
  const y2 = cy - radius * Math.sin(endAngleRad);

  const drawPath = `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2}`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center relative min-h-[280px] h-full">
      <h3 className="font-display font-semibold text-xs text-slate-400 absolute top-5 left-5 uppercase tracking-wider">Live Load Meter</h3>
      
      <div className="relative w-[200px] h-[160px] flex items-center justify-center mt-6">
        <svg className="w-full h-full transform" viewBox={`0 0 ${size} ${size}`}>
          {/* Gauge Track Background */}
          <path
            d={drawPath}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="transition-all duration-300"
          />

          {/* Slices of different zones inside the gauge */}
          {/* We superimpose a glowing active ring */}
          <path
            d={drawPath}
            fill="none"
            stroke={watts > 2000 ? "#f43f5e" : watts > 800 ? "#f59e0b" : "#10b981"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out origin-center"
            style={{
              filter: `drop-shadow(0 0 4px ${watts > 2000 ? "rgba(244,63,94,0.2)" : watts > 800 ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)"})`,
            }}
          />
        </svg>

        {/* Numeric text layered in the middle */}
        <div className="absolute top-[35%] flex flex-col items-center text-center">
          <div className="p-2 rounded-full bg-slate-50 border border-slate-200 mb-1">
            <Zap className={`w-4 h-4 ${watts > 2000 ? "text-rose-500 animate-pulse" : watts > 800 ? "text-amber-500" : "text-emerald-500"}`} />
          </div>
          <span className="font-display text-4xl font-black text-indigo-600 tracking-tight leading-none mt-1">
            {watts.toFixed(0)} <span className="text-xs font-semibold text-slate-400">W</span>
          </span>
          <span className="text-[9px] text-slate-400 mt-2.5 tracking-wider uppercase font-mono font-bold">
            {watts > 2000 ? "CRITICAL DRAW" : watts > 800 ? "HIGH DEMAND" : "ECO RANGE"}
          </span>
        </div>
      </div>

      {/* Scale labels */}
      <div className="w-full flex justify-between px-6 text-[10px] text-slate-400 font-mono tracking-wider font-semibold">
        <span>0W</span>
        <span className="text-amber-600">800W</span>
        <span className="text-rose-600">2KW</span>
        <span>{maxLimit / 1000}KW</span>
      </div>
    </div>
  );
}
