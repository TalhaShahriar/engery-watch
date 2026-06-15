import React, { useState, useEffect } from "react";
import { calculateBillProgressive, TariffSettings } from "../utils/billCalc.ts";
import { TrendingUp, Award, Calendar, DollarSign, Sliders, ChevronRight } from "lucide-react";

interface BillPredictionData {
  currentKwhThisMonth: number;
  projectedKwh: number;
  projectedBill: number;
  currentBill: number;
  optimisticBill: number;
  pessimisticBill: number;
  optimisticKwh: number;
  pessimisticKwh: number;
  breakdown: any[];
  meterRent: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyAverage: number;
}

interface BillForecastPanelProps {
  prediction: BillPredictionData | null;
  tariffSettings: TariffSettings;
}

export default function BillForecastPanel({ prediction, tariffSettings }: BillForecastPanelProps) {
  const [sliderDailyKwh, setSliderDailyKwh] = useState<number>(1.5);

  useEffect(() => {
    if (prediction) {
      setSliderDailyKwh(prediction.dailyAverage);
    }
  }, [prediction]);

  if (!prediction) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-md font-mono py-12 text-slate-500">
        Syncing electricity billing metrics...
      </div>
    );
  }

  // Calculate customized projection based on manual slider
  const manualRemainingDays = prediction.daysRemaining;
  const manualProjectedKwh = prediction.currentKwhThisMonth + (sliderDailyKwh * manualRemainingDays);
  const manualCalculation = calculateBillProgressive(manualProjectedKwh, tariffSettings);

  const getSlabColorClass = (taka: number) => {
    if (taka < 500) return "text-emerald-700 bg-emerald-50 border-emerald-150";
    if (taka < 1200) return "text-amber-700 bg-amber-50 border-amber-150";
    return "text-rose-700 bg-rose-50 border-rose-150";
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="font-display font-bold text-base text-slate-900">Electricity Bill Predictor</h3>
          <p className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
            BPDB PROGRESSIVE RESIDENTIAL TARIFF ENGINE • MONTH ELAPSED: {prediction.daysElapsed}/{prediction.daysElapsed + prediction.daysRemaining} DAYS
          </p>
        </div>

        {/* Projected Amount Bubble */}
        <div className={`px-4 py-2 border rounded-xl flex items-center gap-2 ${getSlabColorClass(manualCalculation.totalTaka)}`}>
          <DollarSign className="w-4 h-4" />
          <div className="text-right">
            <span className="text-[9px] font-mono uppercase block text-slate-500 font-bold leading-none">End of Month Projection</span>
            <span className="font-mono font-black text-base">Tk {manualCalculation.totalTaka.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Main KPI overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-50 p-4 border border-slate-205 rounded-xl">
          <span className="text-[9px] font-mono text-slate-400 font-bold uppercase block tracking-wider mb-1">
            Current used this Month
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <h2 className="font-mono text-2xl font-bold text-slate-800">
              {prediction.currentKwhThisMonth.toFixed(2)}
            </h2>
            <span className="text-xs text-slate-500 font-display">kWh</span>
          </div>
          <span className="text-[10px] text-slate-500 block leading-none mt-2 font-mono font-medium">
            Accrued bill (at current level): Tk {prediction.currentBill.toFixed(1)}
          </span>
        </div>

        <div className="bg-slate-50 p-4 border border-slate-205 rounded-xl">
          <span className="text-[9px] font-mono text-slate-400 font-bold uppercase block tracking-wider mb-1">
            Historical daily Average
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <h2 className="font-mono text-2xl font-bold text-slate-800">
              {prediction.dailyAverage.toFixed(2)}
            </h2>
            <span className="text-xs text-slate-500 font-display">kWh/day</span>
          </div>
          <span className="text-[10px] text-slate-500 block leading-none mt-2 font-mono font-medium">
            Optimistic low EOM target: Tk {prediction.optimisticBill.toFixed(0)}
          </span>
        </div>

        <div className="bg-slate-50 p-4 border border-slate-205 rounded-xl">
          <span className="text-[9px] font-mono text-slate-400 font-bold uppercase block tracking-wider mb-1">
            Projected EOM Consumption
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <h2 className="font-mono text-2xl font-black text-indigo-650">
              {manualProjectedKwh.toFixed(2)}
            </h2>
            <span className="text-xs text-indigo-600 font-display font-semibold">kWh</span>
          </div>
          <span className="text-[10px] text-rose-600 block leading-none mt-2 font-mono font-semibold">
            Pessimistic heavy draw EOM: Tk {prediction.pessimisticBill.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Manual interactive slider simulator */}
      <div className="bg-slate-50 p-5 border border-slate-150 rounded-xl space-y-3">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span className="text-slate-800 font-bold">Interactive Daily Usage Simulator</span>
          </div>
          <span className="font-mono bg-white border border-slate-200 px-3 py-1 rounded text-indigo-600 font-extrabold shadow-sm">
            {sliderDailyKwh.toFixed(2)} kWh/day
          </span>
        </div>

        <input
          type="range"
          min="0.1"
          max={Math.max(10, prediction.dailyAverage * 3.5).toString()}
          step="0.05"
          value={sliderDailyKwh}
          onChange={(e) => setSliderDailyKwh(parseFloat(e.target.value))}
          className="w-full bg-slate-202 h-2 rounded-lg appearance-none cursor-pointer accent-indigo-650"
        />

        <p className="text-[10px] font-mono text-slate-450 leading-relaxed text-center font-medium">
          *Adjust the slider to simulate higher or lower smart plug usage for the remaining{" "}
          <span className="text-slate-700 font-bold">{prediction.daysRemaining} days</span> of the billing month.
        </p>
      </div>

      {/* progressive breakdown slab grid/table */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500 font-bold">Progressive Slab Breakdown Table</span>
          <span className="text-[10px] font-mono text-slate-400 font-bold">*Meter Rental: Tk {prediction.meterRent} included</span>
        </div>

        <div className="border border-slate-205 rounded-xl overflow-hidden font-mono text-xs bg-slate-50/40 shadow-sm">
          <div className="grid grid-cols-4 bg-slate-100 p-3 text-slate-500 font-black border-b border-slate-200">
            <span>TARIFF SLAB SIZES</span>
            <span className="text-center">USED kWh</span>
            <span className="text-center">RATE (Tk)</span>
            <span className="text-right font-mono">SUBTOTAL</span>
          </div>

          <div className="divide-y divide-slate-200">
            {manualCalculation.breakdown.map((item, idx) => (
              <div key={idx} className="grid grid-cols-4 p-3 hover:bg-slate-100/40 text-slate-700 font-semibold">
                <span className="truncate pr-1 text-slate-800 font-bold">{item.slab}</span>
                <span className="text-center text-slate-600">{item.kwh.toFixed(1)} kWh</span>
                <span className="text-center text-slate-500">Tk {item.rate.toFixed(2)}</span>
                <span className="text-right font-bold text-emerald-600">Tk {item.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 p-4 flex justify-between items-center text-xs font-bold text-slate-500 border-t border-slate-200">
            <span>Bangladesh Residential BPDB (Tk 40 Meterrate)</span>
            <span className="text-indigo-650 text-sm font-black">
              Total Calculated: Tk {manualCalculation.totalTaka.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
