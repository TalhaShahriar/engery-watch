import React, { useState } from "react";
import { Plus, Trash2, Calendar, Clock, ToggleLeft, ToggleRight } from "lucide-react";

interface Schedule {
  id: number;
  label: string;
  action: string;
  days: number[];
  timeOfDay: string;
  isActive: boolean;
  createdAt: string;
}

interface SchedulePanelProps {
  schedules: Schedule[];
  onAddSchedule: (sched: { label: string; action: string; days: number[]; timeOfDay: string }) => void;
  onToggleSchedule: (id: number, isActive: boolean) => void;
  onDeleteSchedule: (id: number) => void;
}

const WEEKDAYS = [
  { val: 1, label: "Mon" },
  { val: 2, label: "Tue" },
  { val: 3, label: "Wed" },
  { val: 4, label: "Thu" },
  { val: 5, label: "Fri" },
  { val: 6, label: "Sat" },
  { val: 0, label: "Sun" },
];

export default function SchedulePanel({
  schedules,
  onAddSchedule,
  onToggleSchedule,
  onDeleteSchedule,
}: SchedulePanelProps) {
  // Local form states
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [action, setAction] = useState("on");
  const [time, setTime] = useState("18:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default

  const handleDaySelect = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    if (selectedDays.length === 0) {
      alert("Please select at least one day for weekly repetition.");
      return;
    }
    onAddSchedule({
      label,
      action,
      timeOfDay: time,
      days: selectedDays,
    });
    setLabel("");
    setIsOpen(false);
  };

  const getWeekdaysDescriptor = (days: number[]) => {
    if (days.length === 7) return "Daily";
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "Weekdays";
    if (days.length === 2 && days.includes(0) && days.includes(6)) return "Weekends";
    
    // Sort chronologically starting from Monday
    const order = [1, 2, 3, 4, 5, 6, 0];
    return days
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .map((d) => WEEKDAYS.find((w) => w.val === d)?.label)
      .join(", ");
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="font-display font-semibold text-xs text-slate-400 uppercase tracking-wider">Weekly Schedulers</h3>
          </div>
          
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Schedule
          </button>
        </div>

        {isOpen && (
          <form onSubmit={handleFormSubmit} className="bg-slate-50 p-4 border border-slate-200 rounded-xl mb-4 space-y-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block uppercase font-mono font-bold mb-1">Target Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shut down Microwave"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-white text-xs px-2.5 py-2 border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-indigo-550"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block uppercase font-mono font-bold mb-1">Trigger Action</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full bg-white text-xs px-2.5 py-2 border border-slate-300 rounded text-slate-800 focus:outline-none"
                >
                  <option value="on">Relay SWITCH ON</option>
                  <option value="off">Relay SWITCH OFF</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block uppercase font-mono font-bold mb-1">Trigger Clock (Asia/Dhaka)</label>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-white text-xs px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Weekday repetition bubbles */}
            <div>
              <label className="text-[10px] text-slate-400 block uppercase font-mono font-bold mb-1.5">Days Repetition</label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => {
                  const active = selectedDays.includes(day.val);
                  return (
                    <button
                      type="button"
                      key={day.val}
                      onClick={() => handleDaySelect(day.val)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer border transition-colors ${
                        active 
                          ? "bg-indigo-50 text-indigo-600 border-indigo-250 font-bold" 
                          : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/60">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-150 rounded font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1 text-xs bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow-sm"
              >
                Add rep timer
              </button>
            </div>
          </form>
        )}

        {/* List of timers */}
        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
          {schedules.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl">
              <Clock className="w-7 h-7 text-slate-400 mx-auto mb-2 animate-bounce" />
              <p className="text-[11px] text-slate-450 font-mono font-semibold">No active weekly schedules set up.</p>
            </div>
          ) : (
            schedules.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                  item.isActive 
                    ? "bg-slate-50 border-slate-200 hover:border-indigo-200" 
                    : "bg-slate-50/50 border-slate-200 opacity-60 hover:opacity-100"
                }`}
              >
                <div className="overflow-hidden mr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-slate-800 text-sm truncate">
                      {item.label}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${
                      item.action === "on" 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 font-bold" 
                        : "bg-rose-50 text-rose-600 border-rose-100 font-bold"
                    }`}>
                      {item.action === "on" ? "TURN ON" : "TURN OFF"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1 font-mono font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.timeOfDay}</span>
                    <span className="text-slate-300">•</span>
                    <span>{getWeekdaysDescriptor(item.days)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleSchedule(item.id, !item.isActive)}
                    className="p-1 rounded text-slate-400 hover:text-slate-650"
                  >
                    {item.isActive ? (
                      <ToggleRight className="w-6 h-6 text-indigo-650" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-400" />
                    )}
                  </button>
                  <button
                    onClick={() => onDeleteSchedule(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
