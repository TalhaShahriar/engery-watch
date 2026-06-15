import cron from "node-cron";
import { db, isDatabaseOffline, markDatabaseOffline } from "../db/index.ts";
import { users, energyReadings, settings, dailySummary } from "../db/schema.ts";
import { getDeviceStatus, updateSimulatedReading, isSimulated } from "./tuyaService.ts";
import { checkAlarms } from "./alarmChecker.ts";
import { trackSleepMode } from "./sleepMode.ts";
import { evaluateWeatherRules } from "./weatherService.ts";
import { eq } from "drizzle-orm";
import { 
  inMemoryUsers, 
  inMemorySettings, 
  inMemoryEnergyReadings, 
  inMemoryDailySummary 
} from "../db/memdb.ts";

let pollerJob: any = null;
let weatherJob: any = null;
let midnightSummaryJob: any = null;

// Track poll counts per user to support low-frequency sleep mode (every 60s / skip every second check)
const userPollCounter = new Map<string, number>();

/**
 * Initializes and triggers backend background routines (cron schedulers)
 * @param io Socket.IO instance
 */
export function startTelemetrySchedulers(io: any) {
  // 1. Telemetry Poller: Runs every 30 seconds
  pollerJob = cron.schedule("*/30 * * * * *", async () => {
    try {
      let activeUsers: any[] = [];
      try {
        if (isDatabaseOffline) {
          throw new Error("Preemptive offline mode active.");
        }
        activeUsers = await db.select().from(users);
      } catch (err) {
        markDatabaseOffline();
        // Fallback to active in-memory users list
        activeUsers = Array.from(inMemoryUsers.values());
      }

      for (const user of activeUsers) {
        const userId = user.uid;
        
        // Fetch if sleep mode is currently active
        // Increment user poll skip index
        const currentCount = userPollCounter.get(userId) || 0;
        userPollCounter.set(userId, currentCount + 1);

        // Fetch user smart settings
        let userPrefs: any[] = [];
        try {
          if (isDatabaseOffline) {
            throw new Error("Preemptive offline mode active.");
          }
          userPrefs = await db
            .select()
            .from(settings)
            .where(eq(settings.userId, userId))
            .limit(1);
        } catch (err) {
          markDatabaseOffline();
          const mSettings = inMemorySettings.get(userId);
          userPrefs = mSettings ? [mSettings] : [];
        }

        const carbonFactor = userPrefs[0] ? parseFloat(userPrefs[0].carbonEmissionFactor) : 0.596;

        // Perform sleep mode check
        // Evaluate device telemetry
        const telemetry = await getDeviceStatus();
        const isInSleepNow = await trackSleepMode(userId, telemetry.cur_power / 10, io);

        if (isInSleepNow && (currentCount % 2 === 1)) {
          // Skip this round to reduce telemetry load
          console.log(`User ${userId} plug is asleep. Skipping alternate poller tick (effective 60s interval).`);
          continue;
        }

        // Handle simulation ticks to ensure mock values fluctuate and accumulate kWh safely
        if (isSimulated) {
          updateSimulatedReading(isInSleepNow);
        }

        const freshTelemetry = await getDeviceStatus();
        const wattsRead = freshTelemetry.cur_power / 10; // Convert 0.1W units to Watts
        const voltageRead = freshTelemetry.cur_voltage / 10; // Convert 0.1V units to Volts
        const currentMaRead = freshTelemetry.cur_current; // Already in mA
        const kwhReadToday = freshTelemetry.add_ele; // Cumulative today since midnight or reset
        const carbonKgs = kwhReadToday * carbonFactor;

        // 1. Insert reading into PostgreSQL or Memory map
        let insertedId = Date.now();
        try {
          if (isDatabaseOffline) {
            throw new Error("Preemptive offline mode active.");
          }
          const savedResult = await db.insert(energyReadings).values({
            userId,
            watts: wattsRead.toString(),
            voltage: voltageRead.toString(),
            currentMa: currentMaRead,
            kwhToday: kwhReadToday.toString(),
            carbonKg: carbonKgs.toString(),
          }).returning();
          if (savedResult[0]) {
            insertedId = savedResult[0].id;
          }
        } catch (dbErr: any) {
          markDatabaseOffline();
          if (!inMemoryEnergyReadings.has(userId)) {
            inMemoryEnergyReadings.set(userId, []);
          }
          const mReadings = inMemoryEnergyReadings.get(userId)!;
          insertedId = Math.floor(Math.random() * 100000);
          mReadings.push({
            id: insertedId,
            userId,
            recordedAt: new Date().toISOString(),
            watts: wattsRead.toString(),
            voltage: voltageRead.toString(),
            currentMa: currentMaRead,
            kwhToday: kwhReadToday.toString(),
            carbonKg: carbonKgs.toString(),
          });
          // cap size to 100 entries to prevent memory overflow
          if (mReadings.length > 100) mReadings.shift();
        }

        const payload = {
          id: insertedId,
          userId,
          recordedAt: new Date().toISOString(),
          watts: wattsRead,
          voltage: voltageRead,
          currentMa: currentMaRead,
          kwhToday: kwhReadToday,
          carbonKg: Number(carbonKgs.toFixed(4)),
          isSleepMode: isInSleepNow,
        };

        // 2. Broadcast updates instantly using Socket.IO
        io.to(userId).emit("energy:update", payload);

        // 3. Evaluate Alarm safety thresholds
        await checkAlarms(userId, {
          watts: wattsRead,
          voltage: voltageRead,
          currentMa: currentMaRead,
          kwhToday: kwhReadToday,
          carbonKg: carbonKgs,
        }, io);
      }
    } catch (error) {
      console.error("Telemetry scheduler loop encountered an error:", error);
    }
  });

  // 2. Weather Evaluator: Runs every 15 minutes
  weatherJob = cron.schedule("*/15 * * * *", async () => {
    try {
      let activeUsers: any[] = [];
      try {
        if (isDatabaseOffline) {
          throw new Error("Preemptive offline mode active.");
        }
        activeUsers = await db.select().from(users);
      } catch (err) {
        markDatabaseOffline();
        activeUsers = Array.from(inMemoryUsers.values());
      }
      for (const user of activeUsers) {
        // Evaluate custom weather action rules
        await evaluateWeatherRules(user.uid, io);
      }
    } catch (error) {
      console.error("Failed to run weather automated checker:", error);
    }
  });

  // 3. Midnight Summary Compiler: Compile daily metrics at 11:59 PM (23:59)
  midnightSummaryJob = cron.schedule("59 23 * * *", async () => {
    try {
      let activeUsers: any[] = [];
      try {
        if (isDatabaseOffline) {
          throw new Error("Preemptive offline mode active.");
        }
        activeUsers = await db.select().from(users);
      } catch (err) {
        markDatabaseOffline();
        activeUsers = Array.from(inMemoryUsers.values());
      }
      const todayString = new Date().toISOString().split("T")[0]!;

      for (const user of activeUsers) {
        const userId = user.uid;

        // Calculate maximum, average, and totals for the day
        let todayReadings: any[] = [];
        try {
          if (isDatabaseOffline) {
            throw new Error("Preemptive offline mode active.");
          }
          todayReadings = await db
            .select()
            .from(energyReadings)
            .where(eq(energyReadings.userId, userId)); // Filter for today's logs ideally
        } catch (err) {
          markDatabaseOffline();
          todayReadings = inMemoryEnergyReadings.get(userId) || [];
        }

        if (todayReadings.length === 0) continue;

        let totalWattsSum = 0;
        let pWatts = 0;
        let cumulativeKwh = 0;
        let cumulativeCarbon = 0;

        todayReadings.forEach((r) => {
          const w = parseFloat(r.watts);
          totalWattsSum += w;
          if (w > pWatts) pWatts = w;
          // Look for highest cumulative energy of the day
          const k = parseFloat(r.kwhToday);
          if (k > cumulativeKwh) cumulativeKwh = k;
          const c = parseFloat(r.carbonKg);
          if (c > cumulativeCarbon) cumulativeCarbon = c;
        });

        const aWatts = totalWattsSum / todayReadings.length;

        // Calculate bill for today
        let userPrefs: any[] = [];
        try {
          if (isDatabaseOffline) {
            throw new Error("Preemptive offline mode active.");
          }
          userPrefs = await db
            .select()
            .from(settings)
            .where(eq(settings.userId, userId))
            .limit(1);
        } catch (err) {
          markDatabaseOffline();
          const mSettings = inMemorySettings.get(userId);
          userPrefs = mSettings ? [mSettings] : [];
        }

        const currentSettings = userPrefs[0] || {
          tariffSlab1Limit: "75",
          tariffSlab1Rate: "3.75",
          tariffSlab2Limit: "200",
          tariffSlab2Rate: "5.26",
          tariffSlab3Limit: "300",
          tariffSlab3Rate: "5.62",
          tariffSlab4Limit: "400",
          tariffSlab4Rate: "6.09",
          tariffSlab5Rate: "9.30",
        };

        const slab1Rate = parseFloat(currentSettings.tariffSlab1Rate);
        const estimatedDailyCost = cumulativeKwh * slab1Rate; // Simplified marginal rate approximation for daily log

        // Write to daily_summary schema or update existing
        try {
          if (isDatabaseOffline) {
            throw new Error("Preemptive offline mode active.");
          }
          await db.insert(dailySummary).values({
            userId,
            date: todayString,
            totalKwh: cumulativeKwh.toString(),
            totalCarbonKg: cumulativeCarbon.toString(),
            peakWatts: pWatts.toString(),
            avgWatts: aWatts.toString(),
            estimatedBillTaka: estimatedDailyCost.toString(),
          }).onConflictDoUpdate({
            target: [dailySummary.userId, dailySummary.date],
            set: {
              totalKwh: cumulativeKwh.toString(),
              totalCarbonKg: cumulativeCarbon.toString(),
              peakWatts: pWatts.toString(),
              avgWatts: aWatts.toString(),
              estimatedBillTaka: estimatedDailyCost.toString(),
            }
          });
        } catch (dbErr: any) {
          markDatabaseOffline();
          if (!inMemoryDailySummary.has(userId)) {
            inMemoryDailySummary.set(userId, []);
          }
          const mSummaries = inMemoryDailySummary.get(userId)!;
          const existingSummaryIdx = mSummaries.findIndex(s => s.date === todayString);
          const newSummary = {
            id: Math.floor(Math.random() * 100000),
            userId,
            date: todayString,
            totalKwh: cumulativeKwh.toString(),
            totalCarbonKg: cumulativeCarbon.toString(),
            peakWatts: pWatts.toString(),
            avgWatts: aWatts.toString(),
            estimatedBillTaka: estimatedDailyCost.toString(),
          };
          if (existingSummaryIdx !== -1) {
            mSummaries[existingSummaryIdx] = newSummary;
          } else {
            mSummaries.push(newSummary);
          }
        }

        console.log(`Midnight recap synthesized successfully for user ${userId}. Totalling ${cumulativeKwh} kWh.`);
      }
    } catch (error) {
      console.error("Midnight daily recap syntherizer failed:", error);
    }
  });

  console.log("Telemetry and weather background crons started successfully.");
}

export function stopTelemetrySchedulers() {
  if (pollerJob) pollerJob.stop();
  if (weatherJob) weatherJob.stop();
  if (midnightSummaryJob) midnightSummaryJob.stop();
  console.log("Daemon background synchronizers stopped.");
}
