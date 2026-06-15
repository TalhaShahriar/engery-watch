import React, { useState } from "react";
import { Power, Moon, Sun, Cpu, Zap } from "lucide-react";
import { motion } from "motion/react";

interface DeviceCardProps {
  switchState: boolean;
  watts: number;
  voltage: number;
  currentMa: number;
  isSleepMode: boolean;
  isToggling: boolean;
  onToggle: (state: boolean) => void;
}

export default function DeviceCard({
  switchState,
  watts,
  voltage,
  currentMa,
  isSleepMode,
  isToggling,
  onToggle,
}: DeviceCardProps) {
  return (
    <div className="relative group overflow-hidden bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-indigo-200 transition-all duration-300 h-full flex flex-col justify-between">
      {/* Background radial gradient indicator */}
      <div className={`absolute -right-12 -top-12 w-32 h-32 blur-3xl opacity-15 rounded-full transition-colors duration-500 ${
        switchState ? (isSleepMode ? "bg-indigo-500" : "bg-emerald-500") : "bg-slate-300"
      }`} />

      <div>
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2.5 items-center">
            <div className={`p-3 rounded-xl border ${
              switchState ? (isSleepMode ? "bg-indigo-50 text-indigo-400 border-indigo-150" : "bg-emerald-50 text-emerald-500 border-emerald-100") : "bg-slate-100 text-slate-400 border-slate-200"
            }`}>
              {switchState ? (
                isSleepMode ? <Moon className="w-5 h-5 animate-pulse" /> : <Sun className="w-5 h-5" />
              ) : (
                <Power className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-slate-900">Smart Plug Relay</h3>
              <p className="text-[10px] text-slate-400 font-mono font-semibold uppercase tracking-wider">
                ID: TUYA-PLUG-01 • {switchState ? (isSleepMode ? "STANDBY SLEEP" : "ACTIVE LOAD") : "SWITCHED OFF"}
              </p>
            </div>
          </div>

          {/* ON/OFF Switch */}
          <button
            onClick={() => onToggle(!switchState)}
            disabled={isToggling}
            className={`relative w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 outline-none ${
              switchState ? "bg-indigo-600" : "bg-slate-200"
            } ${isToggling ? "opacity-50 pointer-events-none" : ""}`}
          >
            <motion.div
              layout
              className="w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center"
              animate={{ x: switchState ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <Power className={`w-3.5 h-3.5 ${switchState ? "text-indigo-600" : "text-slate-400"}`} />
            </motion.div>
          </button>
        </div>

        {/* Main numerical wattage display */}
        <div className="mb-6">
          <span className="text-xs text-slate-400 font-bold tracking-wider uppercase font-mono">Live Power Draw</span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <h1 className="font-display font-black text-5xl text-indigo-600 tracking-tight font-mono">
              {switchState ? watts.toFixed(1) : "0.0"}
            </h1>
            <span className="font-display font-semibold text-lg text-slate-400">Watts</span>
          </div>
        </div>
      </div>

      {/* Secondary voltage and current ratings */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 font-mono text-xs">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
          <span className="text-[9px] text-slate-400 font-bold block mb-1">LINE VOLTAGE</span>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-slate-800 text-sm font-bold">
              {switchState ? voltage.toFixed(1) : "0.0"} V
            </span>
          </div>
        </div>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
          <span className="text-[9px] text-slate-450 font-bold block mb-1">CURRENT LOAD</span>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <span className="text-slate-800 text-sm font-bold">
              {switchState ? currentMa : 0} mA
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
