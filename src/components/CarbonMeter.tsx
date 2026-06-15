import React from "react";
import { Leaf, Award, Compass } from "lucide-react";
import { motion } from "motion/react";

interface CarbonProps {
  carbonToday: number;
  monthCarbon: number;
  dailyLimit: number;
}

export default function CarbonMeter({ carbonToday, monthCarbon, dailyLimit = 3.0 }: CarbonProps) {
  const percent = Math.min((carbonToday / dailyLimit) * 100, 100);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full group">
      <div>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display font-semibold text-xs text-slate-400 uppercase tracking-wider">Carbon Footprint</h3>
          <div className={`p-2 rounded-xl text-[10px] flex items-center gap-1.5 font-mono border font-semibold ${
            percent > 90 ? "bg-rose-50 text-rose-600 border-rose-150" : percent > 60 ? "bg-amber-50 text-amber-600 border-amber-150" : "bg-emerald-50 text-emerald-600 border-emerald-150"
          }`}>
            <Leaf className="w-3.5 h-3.5" />
            <span>Today: {carbonToday.toFixed(3)} kg</span>
          </div>
        </div>

        {/* Big display showing carbon saved/spent */}
        <div className="mb-5">
          <span className="text-[10px] text-slate-400 font-mono tracking-wider block uppercase font-bold mb-1">
            CURRENT MONTH ACCUMULATION
          </span>
          <div className="flex items-baseline gap-1.5">
            <h1 className="font-display font-black text-4xl text-indigo-650 tracking-tight font-mono">
              {monthCarbon.toFixed(2)}
            </h1>
            <span className="text-xs font-bold text-slate-400 font-display">kg CO₂</span>
          </div>
          <p className="text-[10px] text-slate-450 mt-2 leading-relaxed">
            *Based on Bangladesh's national grid carbon intensity of <span className="text-emerald-600 font-semibold font-mono">0.596 kg CO₂/kWh</span>.
          </p>
        </div>

        {/* Dynamic visual slider */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-bold">Daily Emission Ceiling Limit</span>
            <span className="font-mono text-slate-700 font-bold">
              {percent.toFixed(1)}% of {dailyLimit.toFixed(1)} kg
            </span>
          </div>

          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-150">
            <motion.div
              className={`h-full rounded-full ${
                percent > 90 ? "bg-rose-500" : percent > 60 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Sustainability Context Tip */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex gap-3 items-start mt-1">
        <Award className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs">
          <h4 className="font-bold text-slate-800">Environmental Analogy</h4>
          <p className="text-slate-500 mt-0.5 leading-relaxed font-medium">
            {monthCarbon > 0 ? (
              <span>
                Your energy usage represents the carbon sequestration equivalent of planting{" "}
                <span className="text-emerald-600 font-bold">
                  {Math.max(1, Math.round(monthCarbon / 1.6))} trees
                </span>{" "}
                this month.
              </span>
            ) : (
              "Keep usage minimal to reduce pressure on secondary diesel/gas peaking plants in Bangladesh."
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
