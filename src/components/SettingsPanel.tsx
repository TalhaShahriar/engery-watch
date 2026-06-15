import React, { useState, useEffect } from "react";
import { Sliders, Shield, Award, DollarSign, Cloud, Moon, Zap, Save } from "lucide-react";

interface SettingsData {
  tariffSlab1Limit: string;
  tariffSlab1Rate: string;
  tariffSlab2Limit: string;
  tariffSlab2Rate: string;
  tariffSlab3Limit: string;
  tariffSlab3Rate: string;
  tariffSlab4Limit: string;
  tariffSlab4Rate: string;
  tariffSlab5Rate: string;
  carbonEmissionFactor: string;
  carbonDailyLimitKg: string;
  powerLimitWatts: string;
  sleepIdleThresholdWatts: string;
  sleepIdleMinutes: number;
}

interface SettingsPanelProps {
  settings: SettingsData | null;
  onSave: (settings: SettingsData) => void;
  isSaving: boolean;
}

export default function SettingsPanel({ settings, onSave, isSaving }: SettingsPanelProps) {
  // Local settings fields
  const [formData, setFormData] = useState<SettingsData>({
    tariffSlab1Limit: "75",
    tariffSlab1Rate: "3.75",
    tariffSlab2Limit: "200",
    tariffSlab2Rate: "5.26",
    tariffSlab3Limit: "300",
    tariffSlab3Rate: "5.62",
    tariffSlab4Limit: "400",
    tariffSlab4Rate: "6.09",
    tariffSlab5Rate: "9.30",
    carbonEmissionFactor: "0.596",
    carbonDailyLimitKg: "3.0",
    powerLimitWatts: "3000",
    sleepIdleThresholdWatts: "5",
    sleepIdleMinutes: 30,
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({
      ...p,
      [name]: value,
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleFormSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <div>
          <h3 className="font-display font-bold text-base text-slate-900">Application Parameters</h3>
          <p className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
            CALIBRATE SLABS, EMISSION COEFFICIENTS, SAFETY THRESHOLDS, AND INACTIVITY TIME TIMERS
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? "Saving Settings..." : "Save Parameters"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side: Bangladesh progressive billing tariff limits */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            <h4 className="font-display font-bold text-xs text-slate-700 uppercase tracking-wider">progressive BPDB tariff rates</h4>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3.5 text-xs font-mono">
            {/* Slab 1 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase block mb-1">Slab 1 Limit (kWh)</label>
                <input
                  type="number"
                  name="tariffSlab1Limit"
                  value={formData.tariffSlab1Limit}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase block mb-1">Slab 1 price (Tk/kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  name="tariffSlab1Rate"
                  value={formData.tariffSlab1Rate}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>

            {/* Slab 2 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-450 font-bold uppercase block mb-1">Slab 2 Limit (kWh)</label>
                <input
                  type="number"
                  name="tariffSlab2Limit"
                  value={formData.tariffSlab2Limit}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">Slab 2 price (Tk/kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  name="tariffSlab2Rate"
                  value={formData.tariffSlab2Rate}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>

            {/* Slab 3 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">Slab 3 Limit (kWh)</label>
                <input
                  type="number"
                  name="tariffSlab3Limit"
                  value={formData.tariffSlab3Limit}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">Slab 3 price (Tk/kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  name="tariffSlab3Rate"
                  value={formData.tariffSlab3Rate}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>

            {/* Slab 4 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">Slab 4 Limit (kWh)</label>
                <input
                  type="number"
                  name="tariffSlab4Limit"
                  value={formData.tariffSlab4Limit}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">Slab 4 price (Tk/kWh)</label>
                <input
                  type="number"
                  step="0.01"
                  name="tariffSlab4Rate"
                  value={formData.tariffSlab4Rate}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>

            {/* Slab 5 */}
            <div>
              <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">Slab 5 price (Above Slab 4) (Tk/kWh)</label>
              <input
                type="number"
                step="0.01"
                name="tariffSlab5Rate"
                value={formData.tariffSlab5Rate}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Carbon emission limits and sleep modes */}
        <div className="space-y-6">
          {/* Carbon Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-emerald-600" />
              <h4 className="font-display font-bold text-xs text-slate-700 uppercase tracking-wider">Grid Carbon footprint Parameters</h4>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">Coefficient Factor (kg/kWh)</label>
                <input
                  type="number"
                  step="0.001"
                  name="carbonEmissionFactor"
                  value={formData.carbonEmissionFactor}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">Daily Cap Limit (kg/CO₂)</label>
                <input
                  type="number"
                  step="0.1"
                  name="carbonDailyLimitKg"
                  value={formData.carbonDailyLimitKg}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Standby Sleep Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-600" />
              <h4 className="font-display font-bold text-xs text-slate-700 uppercase tracking-wider">Standby Draw Sleep Mode</h4>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">standby Draw Threshold (W)</label>
                <input
                  type="number"
                  step="0.1"
                  name="sleepIdleThresholdWatts"
                  value={formData.sleepIdleThresholdWatts}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">Standby Duration (Minutes)</label>
                <input
                  type="number"
                  name="sleepIdleMinutes"
                  value={formData.sleepIdleMinutes}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Safety Threshold Alert */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-600" />
              <h4 className="font-display font-bold text-xs text-slate-700 uppercase tracking-wider">Hardware Surcharge Limits</h4>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs font-mono">
              <div>
                <label className="text-[10px] text-slate-455 font-bold uppercase block mb-1">Master Power Limit threshold (W)</label>
                <input
                  type="number"
                  name="powerLimitWatts"
                  value={formData.powerLimitWatts}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
