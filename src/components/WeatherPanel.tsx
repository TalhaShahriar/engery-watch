import React, { useState } from "react";
import { CloudRain, Sun, Cloud, CloudLightning, Thermometer, Wind, Plus, Trash2, Sliders, ToggleLeft } from "lucide-react";

interface WeatherRule {
  id: number;
  condition: string;
  threshold: string;
  action: string;
  label: string;
  isActive: boolean;
}

interface WeatherLog {
  id: number;
  firedAt: string;
  conditionValue: string;
  message: string;
}

interface WeatherData {
  temp: number;
  precipitation: number;
  humidity: number;
  weatherCode: number;
  timestamp: string;
}

interface WeatherPanelProps {
  weather: WeatherData;
  rules: WeatherRule[];
  logs: WeatherLog[];
  weatherAutoEnabled: boolean;
  onAddRule: (rule: { condition: string; threshold: number; action: string; label: string }) => void;
  onDeleteRule: (id: number) => void;
  onToggleAutoMode: (enabled: boolean) => void;
}

export default function WeatherPanel({
  weather,
  rules,
  logs,
  weatherAutoEnabled,
  onAddRule,
  onDeleteRule,
  onToggleAutoMode,
}: WeatherPanelProps) {
  // Local form state
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [condition, setCondition] = useState("temp_above");
  const [threshold, setThreshold] = useState("30");
  const [action, setAction] = useState("turn_off");

  const getWeatherIcon = (code: number) => {
    if (code >= 95) return <CloudLightning className="w-8 h-8 text-amber-400" />;
    if (code >= 51 || code >= 80) return <CloudRain className="w-8 h-8 text-cyan-400" />;
    if (code >= 1 && code <= 3) return <Cloud className="w-8 h-8 text-slate-400" />;
    return <Sun className="w-8 h-8 text-amber-500 animate-spin-slow" />;
  };

  const getWeatherText = (code: number) => {
    if (code >= 95) return "Thunderstorms";
    if (code >= 80) return "Rain Showers";
    if (code >= 61) return "Heavy Monsoon";
    if (code >= 51) return "Light Drizzle";
    if (code >= 1) return "Partly Cloudy";
    return "Clear Sunny Sky";
  };

  const getConditionText = (cond: string) => {
    switch (cond) {
      case "temp_above": return "Temp is above";
      case "temp_below": return "Temp is below";
      case "rain": return "Rain detected";
      case "humidity_above": return "Humidity is above";
      default: return cond;
    }
  };

  const getUnit = (cond: string) => {
    if (cond.startsWith("temp")) return "°C";
    if (cond === "rain") return "mm";
    return "%";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onAddRule({
      label,
      condition,
      threshold: parseFloat(threshold),
      action,
    });
    setLabel("");
    setIsOpen(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-xs text-slate-400 uppercase tracking-wider">Weather-Aware Control</h3>
          </div>

          <button
            onClick={() => onToggleAutoMode(!weatherAutoEnabled)}
            className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 cursor-pointer border ${
              weatherAutoEnabled ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"
            }`}
          >
            <ToggleLeft className="w-3.5 h-3.5" />
            <span>AUTO RULE: {weatherAutoEnabled ? "ACTIVE" : "BYPASSED"}</span>
          </button>
        </div>

        {/* Current climate parameters display */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 grid grid-cols-3 gap-3 items-center mb-5">
          <div className="flex flex-col items-start">
            <span className="text-[9px] text-slate-400 font-mono block tracking-wider uppercase font-bold mb-1">CITY: DHAKA</span>
            <div className="flex items-center gap-2">
              {getWeatherIcon(weather.weatherCode)}
              <div>
                <h4 className="font-display font-bold text-slate-800 text-sm leading-tight leading-none mt-0.5">
                  {weather.temp.toFixed(1)}°C
                </h4>
                <p className="text-[10px] text-slate-450 font-mono mt-0.5 whitespace-nowrap">{getWeatherText(weather.weatherCode)}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center text-center border-l border-r border-slate-200">
            <span className="text-[9px] text-slate-400 font-mono tracking-wider uppercase font-bold mb-1">HUMIDITY</span>
            <div className="flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-mono text-xs font-semibold text-slate-700">
                {weather.humidity}%
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <span className="text-[9px] text-slate-400 font-mono tracking-wider uppercase font-bold mb-1">RAIN WATER</span>
            <div className="flex items-center gap-1">
              <CloudRain className="w-3.5 h-3.5 text-cyan-600" />
              <span className="font-mono text-xs font-semibold text-slate-700">
                {weather.precipitation.toFixed(1)} mm
              </span>
            </div>
          </div>
        </div>

        {/* Rules container list */}
        <div className="space-y-3.5 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-bold">Climate Trigger Rules</span>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer font-bold"
            >
              <Plus className="w-4 h-4" /> Add Rule
            </button>
          </div>

          {isOpen && (
            <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-mono font-bold mb-1">Rule Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Turn OFF AC on Rain"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full bg-white border border-slate-305 text-xs px-2.5 py-1.5 rounded text-slate-800 focus:outline-none focus:border-indigo-550"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-mono font-bold mb-1">Condition Trigger</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-xs px-2.5 py-1.5 rounded text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="temp_above">High Temp (Above)</option>
                    <option value="temp_below">Cold Temp (Below)</option>
                    <option value="rain">Monsoon Rain (Precipit.)</option>
                    <option value="humidity_above">High Humidity (Above)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-mono font-bold mb-1">
                    Value Threshold ({getUnit(condition)})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-xs px-2.5 py-1.5 rounded text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-mono font-bold mb-1">Relay Action</label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-xs px-2.5 py-1.5 rounded text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="turn_on">Force Plug ON</option>
                    <option value="turn_off">Force Plug OFF</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 text-[11px] hover:bg-slate-150 rounded text-slate-500 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-[11px] bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow-sm"
                >
                  Save Active Rule
                </button>
              </div>
            </form>
          )}

          <div className="max-h-[140px] overflow-y-auto pr-1 space-y-2">
            {rules.length === 0 ? (
              <p className="text-[11px] text-slate-405 text-center font-mono py-2 font-medium">
                No custom weather rules configured.
              </p>
            ) : (
              rules.map((rule) => {
                const threshVal = parseFloat(rule.threshold);
                return (
                  <div key={rule.id} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-150 font-mono">
                    <div className="overflow-hidden mr-3">
                      <span className="font-bold text-slate-800 block truncate">{rule.label}</span>
                      <p className="text-[10px] text-slate-505 mt-0.5">
                        IF {getConditionText(rule.condition)} {threshVal}{getUnit(rule.condition)} →{" "}
                        <span className={rule.action === "turn_on" ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                          {rule.action === "turn_on" ? "ON" : "OFF"}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Weather Automations logs */}
      <div className="pt-4 border-t border-slate-150">
        <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider block uppercase mb-2">
          AUTOMATED CLIMATE ACTIONS LOG
        </span>
        <div className="space-y-1.5 max-h-[80px] overflow-y-auto text-[10px] font-mono pr-1 text-slate-500">
          {logs.length === 0 ? (
            <p className="text-slate-400 text-center py-1 font-medium">No automatic weather events logged yet.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-1 px-2 hover:bg-slate-50 rounded whitespace-nowrap overflow-hidden text-ellipsis">
                <span className="text-slate-400 font-semibold">[{new Date(log.firedAt).toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" })}]</span>{" "}
                <span className="text-slate-600 font-medium">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
