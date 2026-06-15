import React, { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, RefreshCw, Radio } from "lucide-react";

interface StatusProps {
  apiStatus: "healthy" | "error" | "pinging";
  wsStatus: "connected" | "disconnected" | "reconnecting";
  isSimulated: boolean;
  latencyMs: number;
  lastSync: Date | null;
}

export default function SystemStatus({ apiStatus, wsStatus, isSimulated, latencyMs, lastSync }: StatusProps) {
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (lastSync) {
        setSecondsAgo(Math.floor((Date.now() - lastSync.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastSync]);

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-3 bg-white border border-slate-200 rounded-xl text-xs font-mono shadow-sm">
      <div className="flex items-center gap-2 font-bold">
        <span className="text-slate-400 uppercase">System Status:</span>
      </div>

      {/* Cloud API health indicator */}
      <div className="flex items-center gap-1.5 font-medium">
        <span className={`w-2.5 h-2.5 rounded-full ${
          apiStatus === "healthy" ? "bg-emerald-500 animate-pulse" :
          apiStatus === "pinging" ? "bg-amber-500 animate-spin" : "bg-rose-500"
        }`} />
        <span className="text-slate-700">API: <span className="font-bold">{apiStatus.toUpperCase()}</span></span>
      </div>

      {/* WebSocket indicator */}
      <div className="flex items-center gap-1.5 font-medium">
        <Radio className={`w-3.5 h-3.5 ${
          wsStatus === "connected" ? "text-emerald-500 animate-pulse" : "text-rose-500"
        }`} />
        <span className="text-slate-700">WS: <span className="font-bold">{wsStatus.toUpperCase()}</span></span>
      </div>

      {/* Simulation status */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded font-semibold text-[10px]">
        <span className={`w-1.5 h-1.5 rounded-full ${isSimulated ? "bg-indigo-600" : "bg-amber-500"}`} />
        <span className="text-slate-600">
          {isSimulated ? "DEMO MODE (AUTO-SIMULATING)" : "TUYA LIVE CONNECT"}
        </span>
      </div>

      {/* Latency & Last Sync text */}
      <div className="ml-auto flex items-center gap-3 text-slate-450 font-medium">
        {latencyMs > 0 && <span>Ping: <span className="text-slate-700 font-bold">{latencyMs}ms</span></span>}
        <span>
          Sync: <span className="text-slate-700 font-bold">{lastSync ? (secondsAgo === 0 ? "Just now" : `${secondsAgo}s ago`) : "Never"}</span>
        </span>
      </div>
    </div>
  );
}
