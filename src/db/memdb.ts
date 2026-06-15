import { users, settings, schedules, alarms, alarmEvents, weatherRules, weatherLogs, energyReadings, dailySummary } from "./schema.ts";

// Global in-memory backup database
export const inMemoryUsers = new Map<string, { uid: string; email: string; passwordHash: string; createdAt: Date }>();
export const inMemorySettings = new Map<string, any>();
export const inMemorySchedules = new Map<string, any[]>();
export const inMemoryAlarms = new Map<string, any[]>();
export const inMemoryAlarmEvents = new Map<string, any[]>();
export const inMemoryWeatherRules = new Map<string, any[]>();
export const inMemoryWeatherLogs = new Map<string, any[]>();
export const inMemoryEnergyReadings = new Map<string, any[]>();
export const inMemoryDailySummary = new Map<string, any[]>();

// Seed a default user so that polling schedulers have an active user context immediately
const DEFAULT_USER_UID = "default_user_dhaka_2026";
const DEFAULT_USER_EMAIL = "talharupok2022@gmail.com";

inMemoryUsers.set(DEFAULT_USER_UID, {
  uid: DEFAULT_USER_UID,
  email: DEFAULT_USER_EMAIL,
  passwordHash: "", // simulated local credentials
  createdAt: new Date(),
});

// Seed default settings for the default user
inMemorySettings.set(DEFAULT_USER_UID, {
  userId: DEFAULT_USER_UID,
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
  powerLimitWatts: "3000.0",
  sleepIdleThresholdWatts: "5.0",
  sleepIdleMinutes: 30,
  weatherAutoEnabled: true,
});

// Seed default schedules for default user (e.g., Morning Wake & Late Charger)
inMemorySchedules.set(DEFAULT_USER_UID, [
  {
    id: 101,
    userId: DEFAULT_USER_UID,
    label: "Night Charger",
    action: "off",
    cronExpression: "30 2 * * *",
    days: [0, 1, 2, 3, 4, 5, 6],
    timeOfDay: "02:30",
    isActive: true,
    createdAt: new Date(),
  },
  {
    id: 102,
    userId: DEFAULT_USER_UID,
    label: "Morning Standby",
    action: "on",
    cronExpression: "0 8 * * *",
    days: [1, 2, 3, 4, 5],
    timeOfDay: "08:00",
    isActive: true,
    createdAt: new Date(),
  }
]);

// Seed default alarms (carbon limit, power limit, idle alert)
inMemoryAlarms.set(DEFAULT_USER_UID, [
  {
    id: 201,
    userId: DEFAULT_USER_UID,
    type: "power_limit",
    threshold: "2500.0",
    unit: "W",
    isActive: true,
    notifyPush: true,
    createdAt: new Date(),
  },
  {
    id: 202,
    userId: DEFAULT_USER_UID,
    type: "carbon_limit",
    threshold: "2.5",
    unit: "kg",
    isActive: true,
    notifyPush: true,
    createdAt: new Date(),
  }
]);

// Seed default weather rules
inMemoryWeatherRules.set(DEFAULT_USER_UID, [
  {
    id: 301,
    userId: DEFAULT_USER_UID,
    condition: "temp_above",
    threshold: "32.0",
    action: "turn_on",
    label: "AC Cooling on High Tempm",
    isActive: true,
  },
  {
    id: 302,
    userId: DEFAULT_USER_UID,
    condition: "temp_below",
    threshold: "22.0",
    action: "turn_off",
    label: "Heater switch off",
    isActive: true,
  }
]);

// Seed standard reading history for attractive charting on first screen render
const now = new Date();
const initialReadings: any[] = [];
for (let i = 24; i >= 0; i--) {
  const readTime = new Date(now.getTime() - i * 60 * 60 * 1000);
  const randomWatts = 150 + Math.random() * 400;
  const kwhTodayAccumulated = (25 - i) * 0.18 + Math.random() * 0.05;
  initialReadings.push({
    id: 1000 + i,
    userId: DEFAULT_USER_UID,
    recordedAt: readTime,
    watts: randomWatts.toFixed(1),
    voltage: (218 + Math.random() * 4).toFixed(1),
    currentMa: Math.round((randomWatts / 220) * 1000),
    kwhToday: kwhTodayAccumulated.toFixed(4),
    carbonKg: (kwhTodayAccumulated * 0.596).toFixed(4),
  });
}
inMemoryEnergyReadings.set(DEFAULT_USER_UID, initialReadings);

// Seed Daily Summaries for retrospective graphs
const initialSummaries: any[] = [];
for (let i = 7; i >= 1; i--) {
  const summaryDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const totalKwh = 3.5 + Math.random() * 4.5;
  initialSummaries.push({
    id: 5000 + i,
    userId: DEFAULT_USER_UID,
    date: summaryDate,
    totalKwh: totalKwh.toFixed(4),
    totalCarbonKg: (totalKwh * 0.596).toFixed(4),
    peakWatts: (1800 + Math.random() * 600).toFixed(1),
    avgWatts: (320 + Math.random() * 100).toFixed(1),
    estimatedBillTaka: (totalKwh * 5.62).toFixed(2),
  });
}
inMemoryDailySummary.set(DEFAULT_USER_UID, initialSummaries);

// Sync memory records on authenticated synchronization
export function syncUserInMemory(uid: string, email: string) {
  if (!inMemoryUsers.has(uid)) {
    inMemoryUsers.set(uid, {
      uid,
      email,
      passwordHash: "",
      createdAt: new Date(),
    });
  }
  if (!inMemorySettings.has(uid)) {
    inMemorySettings.set(uid, {
      userId: uid,
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
      powerLimitWatts: "3000.0",
      sleepIdleThresholdWatts: "5.0",
      sleepIdleMinutes: 30,
      weatherAutoEnabled: true,
    });
  }
  if (!inMemorySchedules.has(uid)) {
    inMemorySchedules.set(uid, []);
  }
  if (!inMemoryAlarms.has(uid)) {
    inMemoryAlarms.set(uid, [
      {
        id: Math.floor(Math.random() * 100000),
        userId: uid,
        type: "power_limit",
        threshold: "3000.0",
        unit: "W",
        isActive: true,
        notifyPush: true,
        createdAt: new Date(),
      }
    ]);
  }
  if (!inMemoryAlarmEvents.has(uid)) {
    inMemoryAlarmEvents.set(uid, []);
  }
  if (!inMemoryWeatherRules.has(uid)) {
    inMemoryWeatherRules.set(uid, []);
  }
  if (!inMemoryWeatherLogs.has(uid)) {
    inMemoryWeatherLogs.set(uid, []);
  }
  if (!inMemoryEnergyReadings.has(uid)) {
    // Mirror standard readings
    inMemoryEnergyReadings.set(uid, [...initialReadings.map(r => ({ ...r, userId: uid }))]);
  }
  if (!inMemoryDailySummary.has(uid)) {
    inMemoryDailySummary.set(uid, [...initialSummaries.map(s => ({ ...s, userId: uid }))]);
  }
}
