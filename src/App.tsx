import React, { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import axios from "axios";
import { Toaster, toast } from "react-hot-toast";
import { 
  Cpu, 
  Zap, 
  Settings, 
  Calendar, 
  TrendingUp, 
  LogOut, 
  PhoneCall, 
  Sliders, 
  AlertTriangle,
  History,
  Shield,
  Clock,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ResponsiveContainer, 
  ComposedChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Line, 
  Area,
  Legend
} from "recharts";

// Child Components
import SystemStatus from "./components/SystemStatus.tsx";
import DeviceCard from "./components/DeviceCard.tsx";
import EnergyGauge from "./components/EnergyGauge.tsx";
import CarbonMeter from "./components/CarbonMeter.tsx";
import WeatherPanel from "./components/WeatherPanel.tsx";
import SchedulePanel from "./components/SchedulePanel.tsx";
import BillForecastPanel from "./components/BillForecastPanel.tsx";
import SettingsPanel from "./components/SettingsPanel.tsx";
import Login from "./pages/Login.tsx";

// Types
interface Reading {
  id: number;
  recordedAt: string;
  watts: number | string;
  voltage: number | string;
  currentMa: number;
  kwhToday: number | string;
  carbonKg: number | string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("energy_token"));
  const [userEmail, setUserEmail] = useState<string>(() => localStorage.getItem("energy_email") || "");
  const [userUid, setUserUid] = useState<string>(() => localStorage.getItem("energy_uid") || "");

  // Tabs
  // "dashboard", "schedules", "billing", "settings"
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // System indices
  const [apiStatus, setApiStatus] = useState<"healthy" | "error" | "pinging">("pinging");
  const [wsStatus, setWsStatus] = useState<"connected" | "disconnected" | "reconnecting">("disconnected");
  const [isSimulated, setIsSimulated] = useState<boolean>(true);
  const [pingLatencyMs, setPingLatencyMs] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Live Telemetry states
  const [switchState, setSwitchState] = useState<boolean>(false);
  const [liveWatts, setLiveWatts] = useState<number>(0);
  const [liveVoltage, setLiveVoltage] = useState<number>(220);
  const [liveCurrentMa, setLiveCurrentMa] = useState<number>(0);
  const [liveKwhToday, setLiveKwhToday] = useState<number>(0);
  const [liveCarbonToday, setLiveCarbonToday] = useState<number>(0);
  const [isSleepMode, setIsSleepMode] = useState<boolean>(false);

  // Stats averages
  const [peakWatts, setPeakWatts] = useState<number>(0);
  const [avgWatts, setAvgWatts] = useState<number>(0);
  const [monthKwhTotal, setMonthKwhTotal] = useState<number>(0);
  const [monthCarbonTotal, setMonthCarbonTotal] = useState<number>(0);
  const [powerLimitCeiling, setPowerLimitCeiling] = useState<number>(3000);
  const [dailyCarbonCeiling, setDailyCarbonCeiling] = useState<number>(3);

  // Lists & configs state
  const [chartHistory, setChartHistory] = useState<Reading[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [alarms, setAlarms] = useState<any[]>([]);
  const [alarmHistory, setAlarmHistory] = useState<any[]>([]);
  const [weatherRules, setWeatherRules] = useState<any[]>([]);
  const [weatherLogs, setWeatherLogs] = useState<any[]>([]);
  const [weatherCurrent, setWeatherCurrent] = useState<any>({
    temp: 29.5,
    precipitation: 0.0,
    humidity: 78.0,
    weatherCode: 0,
    timestamp: new Date().toISOString(),
  });
  const [appSettings, setAppSettings] = useState<any>(null);
  const [billPredictions, setBillPredictions] = useState<any>(null);

  // Actions locks
  const [isTogglingDevice, setIsTogglingDevice] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Socket reference
  const socketRef = useRef<any>(null);

  // Set up API Axios authentication headers on token acquisition
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      syncDatabaseData();
      startWebSocketSession();
    } else {
      delete axios.defaults.headers.common["Authorization"];
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    }
  }, [token]);

  // Periodic statistics synchronization (every 15s)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchLiveDashboardStats();
      fetchBillPredictions();
    }, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const syncDatabaseData = async () => {
    setApiStatus("pinging");
    try {
      // 1. Authenticate / register baseline session
      await axios.post("/api/auth/sync");

      // 2. Load all active configurations
      await Promise.all([
        fetchLiveDashboardStats(),
        fetchChartUsageHistory(),
        fetchSchedulesList(),
        fetchAlarmsSetup(),
        fetchAlarmsHistoryLogs(),
        fetchWeatherStatusAndRules(),
        fetchAppConfigurations(),
        fetchBillPredictions(),
      ]);

      setApiStatus("healthy");
      setLastSyncTime(new Date());
    } catch (err) {
      console.error("Synconisation sweep failed:", err);
      setApiStatus("error");
      toast.error("Database synchronisation failed. Verify auth state.");
    }
  };

  const startWebSocketSession = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    // Connect to WebSocket pointing to the same server port
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      setWsStatus("connected");
      console.log("WebSocket linked. Identifying room session...");
      
      // Lock into room keyed by user Firebase UID
      socket.emit("join-room", userUid);

      // Measure latency
      const start = Date.now();
      socket.emit("ping", () => {
        setPingLatencyMs(Date.now() - start);
      });
    });

    socket.on("disconnect", () => {
      setWsStatus("disconnected");
    });

    socket.on("connect_error", () => {
      setWsStatus("reconnecting");
    });

    // Handle real-time telemetry streaming
    socket.on("energy:update", (reading: any) => {
      if (reading.userId === userUid) {
        setLiveWatts(reading.watts);
        setLiveVoltage(reading.voltage);
        setLiveCurrentMa(reading.currentMa);
        setLiveKwhToday(reading.kwhToday);
        setLiveCarbonToday(reading.carbonKg);
        setIsSleepMode(reading.isSleepMode);
        setLastSyncTime(new Date());

        // Stream into chart line queue dynamically
        setChartHistory((prev) => {
          const updated = [...prev, reading];
          if (updated.length > 50) updated.shift(); // Throttle queue size
          return updated;
        });
      }
    });

    // Real-time alarm thresholds trigger broadcast event
    socket.on("alarm:fired", (event: any) => {
      if (event.userId === userUid) {
        // Render beautiful alarm toast warnings
        toast((t) => (
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-slate-100 text-xs">CRITICAL HARDWARE TRIP!</h4>
              <p className="text-[10px] text-slate-350 mt-0.5 leading-normal">{event.message}</p>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="mt-2 px-3 py-1 bg-rose-500 text-slate-950 font-extrabold text-[9px] rounded uppercase"
              >
                Mute Warning
              </button>
            </div>
          </div>
        ), {
          duration: 8000,
          id: `alarm-${event.alarmId}`,
          style: {
            background: "#180f15",
            border: "1px solid #7f1d1d",
            borderRadius: "16px",
            color: "#fca5a5"
          }
        });

        fetchAlarmsHistoryLogs();
      }
    });

    // Standby sleep state notifications
    socket.on("device:sleep", (info: any) => {
      if (info.userId === userUid) {
        setIsSleepMode(true);
        toast.success(info.message, { icon: "🌙", duration: 6000 });
      }
    });

    socket.on("device:awake", (info: any) => {
      if (info.userId === userUid) {
        setIsSleepMode(false);
        setLiveWatts(info.watts);
        toast.success(info.message, { icon: "⚡", duration: 5000 });
      }
    });

    // Schedules triggering
    socket.on("schedule:triggered", (data: any) => {
      if (data.userId === userUid) {
        toast((t) => (
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="font-bold text-[11px] block text-slate-200">Scheduled Trigger Fired!</span>
              <p className="text-[10px] text-slate-400">{data.label} (Automatically turned {data.action.toUpperCase()})</p>
            </div>
          </div>
        ));
        syncDatabaseData();
      }
    });

    // Automated weather controls
    socket.on("weather:action", (data: any) => {
      if (data.userId === userUid) {
        toast((t) => (
          <div className="flex items-start gap-2.5">
            <Cpu className="w-5 h-5 text-cyan-400 animate-spin-slow" />
            <div>
              <span className="font-bold text-[11px] block text-sky-400">Weather Rule Triggered</span>
              <p className="text-[10px] text-slate-300">Plug turned {data.action === "turn_on" ? "ON" : "OFF"}</p>
              <p className="text-[9px] text-slate-500 mt-1">Rule: {data.label}. Reason: {data.message}</p>
            </div>
          </div>
        ));
        syncDatabaseData();
      }
    });
  };

  // REST API Helpers
  const fetchLiveDashboardStats = async () => {
    const res = await axios.get("/api/energy/dashboard");
    if (res.data && res.data.success) {
      const live = res.data.data.live;
      const stats = res.data.data.stats;

      setSwitchState(live.switchState);
      setLiveWatts(live.watts);
      setLiveVoltage(live.voltage);
      setLiveCurrentMa(live.currentMa);
      setLiveKwhToday(live.kwhToday);
      setLiveCarbonToday(live.carbonKgToday);
      setIsSleepMode(live.isSleepMode);

      setPeakWatts(stats.peakWattsToday);
      setAvgWatts(stats.avgWattsToday);
      setMonthKwhTotal(stats.currentMonthKwh);
      setMonthCarbonTotal(stats.currentMonthCarbonKg);
      setPowerLimitCeiling(stats.powerLimitWatts);
      setDailyCarbonCeiling(stats.dailyCarbonCeiling);
    }
  };

  const fetchChartUsageHistory = async () => {
    const res = await axios.get("/api/energy/history");
    if (res.data && res.data.success) {
      // Drizzle parses model as string types sometimes for numeric, parse them safely
      const parsed = res.data.data.map((r: any) => ({
        ...r,
        watts: parseFloat(r.watts),
        voltage: parseFloat(r.voltage),
        kwhToday: parseFloat(r.kwhToday),
        carbonKg: parseFloat(r.carbonKg),
      }));
      setChartHistory(parsed);
    }
  };

  const fetchSchedulesList = async () => {
    const res = await axios.get("/api/schedules");
    if (res.data && res.data.success) {
      setSchedules(res.data.data);
    }
  };

  const fetchAlarmsSetup = async () => {
    const res = await axios.get("/api/alarms");
    if (res.data && res.data.success) {
      setAlarms(res.data.data);
    }
  };

  const fetchAlarmsHistoryLogs = async () => {
    const res = await axios.get("/api/alarms/history");
    if (res.data && res.data.success) {
      setAlarmHistory(res.data.data);
    }
  };

  const fetchWeatherStatusAndRules = async () => {
    const [wCurr, wRules, wLogs] = await Promise.all([
      axios.get("/api/weather/current"),
      axios.get("/api/weather/rules"),
      axios.get("/api/weather/logs"),
    ]);

    if (wCurr.data?.success) setWeatherCurrent(wCurr.data.data);
    if (wRules.data?.success) setWeatherRules(wRules.data.data);
    if (wLogs.data?.success) setWeatherLogs(wLogs.data.data);
  };

  const fetchAppConfigurations = async () => {
    const res = await axios.get("/api/settings");
    if (res.data && res.data.success) {
      setAppSettings(res.data.data);
    }
  };

  const fetchBillPredictions = async () => {
    const res = await axios.get("/api/bill/predict");
    if (res.data && res.data.success) {
      setBillPredictions(res.data.data);
    }
  };

  // Device command controllers
  const handleToggleDevice = async (nextState: boolean) => {
    setIsTogglingDevice(true);
    try {
      const res = await axios.post("/api/device/toggle", { state: nextState });
      if (res.data && res.data.success) {
        setSwitchState(nextState);
        setLiveWatts(nextState ? 245 : 0);
        setLiveCurrentMa(nextState ? 1075 : 0);
        toast.success(`Smart plug successfully turned ${nextState ? "ON" : "OFF"}.`);
      }
    } catch {
      toast.error("Failed to trigger relay. Hardware connection timed out.");
    } finally {
      setIsTogglingDevice(false);
    }
  };

  // Schedules Controllers
  const handleAddSchedule = async (sched: any) => {
    try {
      const res = await axios.post("/api/schedules", sched);
      if (res.data && res.data.success) {
        toast.success("Schedule profile added successfully.");
        fetchSchedulesList();
      }
    } catch {
      toast.error("Failed to append schedule to database.");
    }
  };

  const handleToggleSchedule = async (id: number, activeState: boolean) => {
    try {
      const res = await axios.patch(`/api/schedules/${id}`, { isActive: activeState });
      if (res.data && res.data.success) {
        toast.success(`Schedule rep timer ${activeState ? "enabled" : "silenced"}.`);
        fetchSchedulesList();
      }
    } catch {
      toast.error("Failed to set timer status.");
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    try {
      await axios.delete(`/api/schedules/${id}`);
      toast.success("Schedule deleted successfully.");
      fetchSchedulesList();
    } catch {
      toast.error("Schedules deletion failed.");
    }
  };

  // Weather rules controllers
  const handleAddWeatherRule = async (rule: any) => {
    try {
      const res = await axios.post("/api/weather/rules", rule);
      if (res.data && res.data.success) {
        toast.success("Weather condition rule created.");
        fetchWeatherStatusAndRules();
      }
    } catch {
      toast.error("Failed to persist weather automatic rule.");
    }
  };

  const handleDeleteWeatherRule = async (id: number) => {
    try {
      await axios.delete(`/api/weather/rules/${id}`);
      toast.success("Rule deleted.");
      fetchWeatherStatusAndRules();
    } catch {
      toast.error("Failed to remove weather automatic sequence.");
    }
  };

  const handleToggleWeatherAutoEnabled = async (enabled: boolean) => {
    try {
      const res = await axios.post("/api/settings", { weatherAutoEnabled: enabled });
      if (res.data && res.data.success) {
        toast.success(`Automations ${enabled ? "resumed" : "silenced"}`);
        fetchAppConfigurations();
      }
    } catch {
      toast.error("Failed to modify automation state.");
    }
  };

  // Safety alarm controllers
  const handleAddAlarm = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const type = (form.elements.namedItem("type") as HTMLSelectElement).value;
    const threshold = parseFloat((form.elements.namedItem("threshold") as HTMLInputElement).value);
    const unit = type === "power_limit" ? "W" : "kg";

    try {
      const res = await axios.post("/api/alarms", { type, threshold, unit });
      if (res.data && res.data.success) {
        toast.success("Safety alert parameter appended.");
        form.reset();
        fetchAlarmsSetup();
      }
    } catch {
      toast.error("Failed to save alert parameters.");
    }
  };

  const handleDeleteAlarm = async (id: number) => {
    try {
      await axios.delete(`/api/alarms/${id}`);
      toast.success("Alarm parameters deleted.");
      fetchAlarmsSetup();
    } catch {
      toast.error("Failed to erase alarm constraints.");
    }
  };

  // Settings controllers
  const handleSaveAppConfigurations = async (configs: any) => {
    setIsSavingSettings(true);
    try {
      const res = await axios.post("/api/settings", configs);
      if (res.data && res.data.success) {
        toast.success("Configuration updated successfully.");
        fetchAppConfigurations();
        fetchLiveDashboardStats();
        fetchBillPredictions();
      }
    } catch {
      toast.error("Failed to update application preferences.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("energy_token");
    localStorage.removeItem("energy_email");
    localStorage.removeItem("energy_uid");
    setToken(null);
    setUserEmail("");
    setUserUid("");
    toast.success("Disconnected security instance.");
  };

  // Auth Landing Gate
  if (!token) {
    return <Login onLoginSuccess={(t, email, uid) => {
      localStorage.setItem("energy_token", t);
      localStorage.setItem("energy_email", email);
      localStorage.setItem("energy_uid", uid);
      setToken(t);
      setUserEmail(email);
      setUserUid(uid);
      toast.success(`Secure session established: ${email}`);
    }} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-between text-slate-800 font-sans antialiased text-sm">
      <Toaster position="top-right" />

      {/* Main layout frame */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Superior Rail Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-650 flex items-center justify-center text-white p-2.5 shadow-sm">
              <Cpu className="w-full h-full" />
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <h1 className="font-display font-extrabold text-xl tracking-tight text-slate-900">
                  EnergyWatch <span className="text-indigo-600">BD</span>
                </h1>
                <span className="text-[10px] font-mono text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">Smart Life IoT</span>
              </div>
              <p className="text-xs text-slate-450 leading-none mt-1">
                Security terminal: <span className="font-sans text-slate-600 font-semibold">{userEmail}</span>
              </p>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="w-4 h-4" /> },
              { id: "schedules", label: "Schedules & Alarms", icon: <Calendar className="w-4 h-4" /> },
              { id: "billing", label: "Bills Predictor", icon: <Sliders className="w-4 h-4" /> },
              { id: "settings", label: "Calibrations", icon: <Settings className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors border ${
                  activeTab === tab.id 
                    ? "bg-white border-slate-350 text-indigo-600 font-bold shadow-sm" 
                    : "text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}

            <button
              onClick={handleLogout}
              className="p-2 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100/70 rounded-2xl flex items-center gap-1.5 text-xs cursor-pointer font-bold ml-2 shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </div>
        </header>

        {/* System latency & sync line */}
        <div className="mb-6">
          <SystemStatus
            apiStatus={apiStatus}
            wsStatus={wsStatus}
            isSimulated={isSimulated}
            latencyMs={pingLatencyMs}
            lastSync={lastSyncTime}
          />
        </div>

        {/* Stateful panels */}
        <main className="min-h-[500px]">
          <AnimatePresence mode="wait">
            
            {/* PANEL 1: DASHBOARD */}
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-6"
              >
                {/* Visual Widgets Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="md:col-span-2 lg:col-span-1">
                    <DeviceCard
                      switchState={switchState}
                      watts={liveWatts}
                      voltage={liveVoltage}
                      currentMa={liveCurrentMa}
                      isSleepMode={isSleepMode}
                      isToggling={isTogglingDevice}
                      onToggle={handleToggleDevice}
                    />
                  </div>

                  <EnergyGauge watts={switchState ? liveWatts : 0} maxLimit={powerLimitCeiling} />
                  
                  <div className="md:col-span-2 lg:col-span-1">
                    <CarbonMeter
                      carbonToday={liveCarbonToday}
                      monthCarbon={monthCarbonTotal}
                      dailyLimit={dailyCarbonCeiling}
                    />
                  </div>

                  <WeatherPanel
                    weather={weatherCurrent}
                    rules={weatherRules}
                    logs={weatherLogs}
                    weatherAutoEnabled={appSettings?.weatherAutoEnabled ?? true}
                    onAddRule={handleAddWeatherRule}
                    onDeleteRule={handleDeleteWeatherRule}
                    onToggleAutoMode={handleToggleWeatherAutoEnabled}
                  />
                </div>

                {/* HISTORICAL CHART - RECHARTS */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 font-mono">
                  <div>
                    <h3 className="font-display font-bold text-sm text-slate-800">Historical Consumption Trends</h3>
                    <p className="text-[10px] text-slate-400 font-mono font-bold uppercase mt-0.5">
                      Dual Axis Timeline: Live Power Consumption (Watts, solid line) × Today's Accumulation (kWh, filled area under curve)
                    </p>
                  </div>

                  <div className="w-full h-72">
                    {chartHistory.length === 0 ? (
                      <div className="w-full h-full flex items-center justify-center font-mono text-xs text-slate-600">
                        Gathering timeline parameters... Sync in progress...
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorKwh" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="recordedAt" 
                            stroke="#64748b" 
                            fontSize={10}
                            fontFamily="JetBrains Mono"
                            tickFormatter={(t) => new Date(t).toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          />
                          <YAxis 
                            yAxisId="left" 
                            stroke="#f59e0b" 
                            fontSize={10} 
                            fontFamily="JetBrains Mono"
                            label={{ value: "Power Draw (W)", angle: -90, position: "insideLeft", offset: 15, fill: "#f59e0b", fontSize: 9, fontFamily: "Inter" }}
                          />
                          <YAxis 
                            yAxisId="right" 
                            orientation="right" 
                            stroke="#10b981" 
                            fontSize={10} 
                            fontFamily="JetBrains Mono"
                            label={{ value: "Accumulated (kWh)", angle: 90, position: "insideRight", offset: 15, fill: "#10b981", fontSize: 9, fontFamily: "Inter" }}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#ffffff", borderColor: "#f1f5f9", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                            labelStyle={{ color: "#475569", fontSize: "10px", fontFamily: "JetBrains Mono" }}
                            labelFormatter={(label) => `Time: ${new Date(label).toLocaleString("en-US", { timeZone: "Asia/Dhaka" })}`}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "Inter", paddingTop: "10px" }} />
                          <Area 
                            yAxisId="right"
                            name="Today's kWh Total" 
                            type="monotone" 
                            dataKey="kwhToday" 
                            fill="url(#colorKwh)" 
                            stroke="#10b981" 
                            strokeWidth={1.5}
                          />
                          <Line 
                            yAxisId="left"
                            name="Live Watts" 
                            type="monotone" 
                            dataKey="watts" 
                            stroke="#f59e0b" 
                            strokeWidth={2} 
                            dot={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* PANEL 2: SCHEDULES & ALARMS */}
            {activeTab === "schedules" && (
              <motion.div
                key="schedules"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                <SchedulePanel
                  schedules={schedules}
                  onAddSchedule={handleAddSchedule}
                  onToggleSchedule={handleToggleSchedule}
                  onDeleteSchedule={handleDeleteSchedule}
                />

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                      <h3 className="font-display font-bold text-sm text-slate-800">Safety Surcharging Threshold Alerts</h3>
                    </div>

                    <form onSubmit={handleAddAlarm} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 font-mono text-xs shadow-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Limit Parameter Group</label>
                          <select
                            name="type"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-sans"
                          >
                            <option value="power_limit">Power Drawing Surge (W)</option>
                            <option value="carbon_limit">Today's CO₂ Ceiling (kg)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Threshold</label>
                          <input
                            type="number"
                            name="threshold"
                            placeholder="e.g. 2000"
                            required
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer font-sans shadow-sm"
                        >
                          Arm Alert Sentry
                        </button>
                      </div>
                    </form>

                    {/* Active Alarms list */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block">
                        Armed Safety Limits
                      </span>

                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {alarms.length === 0 ? (
                          <p className="text-[11px] text-slate-450 text-center font-mono py-2 font-bold">
                            No security alarm parameters armed.
                          </p>
                        ) : (
                          alarms.map((al) => (
                            <div key={al.id} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-mono shadow-sm">
                              <div>
                                <span className="font-extrabold text-slate-800">
                                  {al.type === "power_limit" ? "Draw Surge Limit" : "Emmision Carbon Cap"}
                                </span>
                                <span className="text-[10px] text-slate-500 block font-medium mt-0.5">
                                  Trigger IF draw goes &gt;= {al.threshold} {al.unit}
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteAlarm(al.id)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Alarm Incidents Log */}
                  <div className="pt-4 border-t border-slate-200 mt-4">
                    <span className="text-[10px] text-slate-400 font-mono font-bold tracking-wider block uppercase mb-2">
                      RECENT TRIP INCIDENT REPORTS LOG
                    </span>
                    <div className="space-y-1.5 max-h-[110px] overflow-y-auto text-[10px] font-mono pr-1 text-slate-500">
                      {alarmHistory.length === 0 ? (
                        <p className="text-slate-400 text-center py-2 font-semibold">All armed sentries reporting zero safety exceptions.</p>
                      ) : (
                        alarmHistory.map((hist) => (
                          <div key={hist.id} className="p-2 bg-rose-50 border border-rose-100 font-medium rounded-xl hover:bg-rose-50/80">
                            <span className="text-rose-700 font-bold block">
                              [{new Date(hist.firedAt).toLocaleString("en-US", { timeZone: "Asia/Dhaka" })}] ALERT TRIP TRIGGERED
                            </span>
                            <span className="text-slate-600 block mt-0.5">{hist.message}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PANEL 3: BILL PREDICTOR */}
            {activeTab === "billing" && (
              <motion.div
                key="billing"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
              >
                <BillForecastPanel 
                  prediction={billPredictions} 
                  tariffSettings={{
                    tariffSlab1Limit: parseFloat(appSettings?.tariffSlab1Limit || "75"),
                    tariffSlab1Rate: parseFloat(appSettings?.tariffSlab1Rate || "3.75"),
                    tariffSlab2Limit: parseFloat(appSettings?.tariffSlab2Limit || "200"),
                    tariffSlab2Rate: parseFloat(appSettings?.tariffSlab2Rate || "5.26"),
                    tariffSlab3Limit: parseFloat(appSettings?.tariffSlab3Limit || "300"),
                    tariffSlab3Rate: parseFloat(appSettings?.tariffSlab3Rate || "5.62"),
                    tariffSlab4Limit: parseFloat(appSettings?.tariffSlab4Limit || "400"),
                    tariffSlab4Rate: parseFloat(appSettings?.tariffSlab4Rate || "6.09"),
                    tariffSlab5Rate: parseFloat(appSettings?.tariffSlab5Rate || "9.30"),
                  }}
                />
              </motion.div>
            )}

            {/* PANEL 4: CALIBRATIONS / SETTINGS */}
            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
              >
                <SettingsPanel
                  settings={appSettings}
                  onSave={handleSaveAppConfigurations}
                  isSaving={isSavingSettings}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Aesthetic base footer */}
      <footer className="w-full max-w-7xl mx-auto border-t border-slate-200 mt-12 py-6 px-4 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center text-xs text-slate-450 gap-2 font-mono font-bold uppercase">
        <span>EnergyWatch BD • Micro-grid IoT Telemetry Dashboard • Dhaka, Bangladesh</span>
        <div className="flex gap-4">
          <span className="text-[10px] font-mono hover:text-indigo-600 cursor-pointer">API DOCUMENTATION VER v1.1</span>
          <span className="text-[10px] font-mono hover:text-indigo-600 cursor-pointer">SSL ENCRYPTED SHA-256</span>
        </div>
      </footer>
    </div>
  );
}
