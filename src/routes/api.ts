import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRequest, requireAuth } from "../middleware/auth.ts";
import { db, isDatabaseOffline, markDatabaseOffline } from "../db/index.ts";
import { 
  users, 
  energyReadings, 
  dailySummary, 
  schedules, 
  alarms, 
  alarmEvents, 
  weatherRules, 
  weatherLogs, 
  settings 
} from "../db/schema.ts";
import { getDeviceStatus, toggleDevice, isSimulated } from "../services/tuyaService.ts";
import { getBillPrediction } from "../services/billPredictor.ts";
import { getLatestWeather } from "../services/weatherService.ts";
import { eq, and, desc, like } from "drizzle-orm";
import { 
  inMemoryUsers, 
  inMemorySettings, 
  inMemorySchedules, 
  inMemoryAlarms, 
  inMemoryAlarmEvents, 
  inMemoryWeatherRules, 
  inMemoryWeatherLogs, 
  inMemoryEnergyReadings, 
  inMemoryDailySummary 
} from "../db/memdb.ts";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "energywatch_bd_secret_key_2026_dhaka";

// Auth: Register Endpoint
router.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters long." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const generatedUid = "user_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now().toString(36);

    try {
      if (isDatabaseOffline) {
        throw new Error("Preemptive offline fallback active.");
      }
      // Check if user already exists in PostgreSQL
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ success: false, error: "A user with this email already exists." });
      }

      // Create user
      const inserted = await db
        .insert(users)
        .values({
          uid: generatedUid,
          email: normalizedEmail,
          passwordHash: passwordHash,
        })
        .returning();

      // Create basic settings row
      await db
        .insert(settings)
        .values({
          userId: generatedUid,
        })
        .onConflictDoNothing();

      const userRecord = inserted[0] || { uid: generatedUid, email: normalizedEmail };
      const token = jwt.sign({ uid: userRecord.uid, email: userRecord.email }, JWT_SECRET, { expiresIn: "7d" });

      return res.json({
        success: true,
        token,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
        },
      });

    } catch (dbErr: any) {
      const wasOnline = !isDatabaseOffline;
      markDatabaseOffline();
      if (wasOnline) {
        console.info("Database not connected during register; falling back to in-memory store smoothly.");
      }

      // Fallback: Check in-memory database
      for (const [_, val] of inMemoryUsers.entries()) {
        if (val.email === normalizedEmail) {
          return res.status(400).json({ success: false, error: "A user with this email already exists." });
        }
      }

      // Add to in-memory store
      inMemoryUsers.set(generatedUid, {
        uid: generatedUid,
        email: normalizedEmail,
        passwordHash,
        createdAt: new Date(),
      });

      inMemorySettings.set(generatedUid, {
        userId: generatedUid,
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

      const token = jwt.sign({ uid: generatedUid, email: normalizedEmail }, JWT_SECRET, { expiresIn: "7d" });

      return res.json({
        success: true,
        token,
        user: {
          uid: generatedUid,
          email: normalizedEmail,
        },
      });
    }
  } catch (error: any) {
    console.error("Register endpoint failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Auth: Login Endpoint
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    try {
      if (isDatabaseOffline) {
        throw new Error("Preemptive offline fallback active.");
      }
      // Find matching user in PostgreSQL
      const matches = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      const userRecord = matches[0];
      if (!userRecord) {
        return res.status(401).json({ success: false, error: "Invalid email or password." });
      }

      if (!userRecord.passwordHash) {
        return res.status(401).json({ success: false, error: "This user does not have a local password. Please register with a password first." });
      }

      const passMatch = await bcrypt.compare(password, userRecord.passwordHash);
      if (!passMatch) {
        return res.status(401).json({ success: false, error: "Invalid email or password." });
      }

      const token = jwt.sign({ uid: userRecord.uid, email: userRecord.email }, JWT_SECRET, { expiresIn: "7d" });

      return res.json({
        success: true,
        token,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
        },
      });

    } catch (dbErr: any) {
      const wasOnline = !isDatabaseOffline;
      markDatabaseOffline();
      if (wasOnline) {
        console.info("Database offline during login. Reading in-memory credential cache smoothly.");
      }

      // Fallback: Check in-memory store
      let matchedUser: any = null;
      for (const [_, val] of inMemoryUsers.entries()) {
        if (val.email === normalizedEmail) {
          matchedUser = val;
          break;
        }
      }

      if (!matchedUser) {
        return res.status(401).json({ success: false, error: "Invalid email or password." });
      }

      const passMatch = await bcrypt.compare(password, matchedUser.passwordHash);
      if (!passMatch) {
        return res.status(401).json({ success: false, error: "Invalid email or password." });
      }

      const token = jwt.sign({ uid: matchedUser.uid, email: matchedUser.email }, JWT_SECRET, { expiresIn: "7d" });

      return res.json({
        success: true,
        token,
        user: {
          uid: matchedUser.uid,
          email: matchedUser.email,
        },
      });
    }
  } catch (error: any) {
    console.error("Login endpoint failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Group 1: Auth Info Synchronisation
router.post("/auth/sync", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let profile: any = null;
    let userPrefs: any = null;

    try {
      if (isDatabaseOffline) {
        throw new Error("Preemptive offline fallback active.");
      }
      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.uid, user.uid))
        .limit(1);
      profile = userRecord[0];

      const userPrefsQueryResult = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, user.uid))
        .limit(1);
      userPrefs = userPrefsQueryResult[0];

    } catch (dbErr: any) {
      const wasOnline = !isDatabaseOffline;
      markDatabaseOffline();
      if (wasOnline) {
        console.info("Database sync query fallback to in-memory store smoothly.");
      }
      profile = inMemoryUsers.get(user.uid) || { uid: user.uid, email: user.email, passwordHash: "", createdAt: new Date() };
      userPrefs = inMemorySettings.get(user.uid) || {
        userId: user.uid,
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
      };
    }

    res.json({
      success: true,
      data: {
        profile,
        settings: userPrefs,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Group 2: Smart Plug Relay Control
router.get("/device/status", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const status = await getDeviceStatus();
    res.json({
      success: true,
      data: {
        ...status,
        isSimulated,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/device/toggle", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { state } = req.body;
    if (typeof state !== "boolean") {
      return res.status(400).json({ success: false, error: "Relay state parameter must be a boolean." });
    }

    const success = await toggleDevice(state);
    if (success) {
      res.json({ success: true, message: `Device toggled ${state ? "ON" : "OFF"} successfully.` });
    } else {
      res.status(500).json({ success: false, error: "Failed to issue toggle command to smart plug." });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Group 3: Real-Time Energy Analytics & Stats
router.get("/energy/history", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let logs: any[] = [];
    
    try {
      if (isDatabaseOffline) {
        throw new Error("Preemptive offline fallback active.");
      }
      logs = await db
        .select()
        .from(energyReadings)
        .where(eq(energyReadings.userId, user.uid))
        .orderBy(desc(energyReadings.recordedAt))
        .limit(60); // Roughly last 30 minutes of history
      
      logs.reverse(); // chronologically ordered
    } catch (dbErr: any) {
      const wasOnline = !isDatabaseOffline;
      markDatabaseOffline();
      if (wasOnline) {
        console.info("Database not connected for history query; switching to in-memory backup successfully.");
      }
      const inMemList = inMemoryEnergyReadings.get(user.uid) || [];
      logs = [...inMemList]; // already chronological or we can map them safely
    }

    res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/energy/dashboard", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const currentMonthPrefix = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    // 1. Fetch live telemetry status
    const status = await getDeviceStatus();
    const liveWatts = status.cur_power / 10;
    const todayLiveKwh = status.add_ele;

    let monthKwh = 0;
    let monthCarbon = 0;
    let activeSettings: any = null;
    let historicReadingsToday: any[] = [];

    try {
      if (isDatabaseOffline) {
        throw new Error("Preemptive offline fallback active.");
      }
      // 2. Load summaries for this month to sum cumulative parameters
      const monthSummaries = await db
        .select()
        .from(dailySummary)
        .where(
          and(
            eq(dailySummary.userId, user.uid),
            like(dailySummary.date, `${currentMonthPrefix}%`)
          )
        );

      monthSummaries.forEach((s) => {
        monthKwh += parseFloat(s.totalKwh);
        monthCarbon += parseFloat(s.totalCarbonKg);
      });

      monthKwh += todayLiveKwh;

      const userPrefs = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, user.uid))
        .limit(1);

      activeSettings = userPrefs[0] || {
        carbonEmissionFactor: "0.596",
        carbonDailyLimitKg: "3.0",
        powerLimitWatts: "3000.0",
      };

      const emissionFactor = parseFloat(activeSettings.carbonEmissionFactor);
      monthCarbon += (todayLiveKwh * emissionFactor);

      // 3. Load peak work today
      historicReadingsToday = await db
        .select()
        .from(energyReadings)
        .where(eq(energyReadings.userId, user.uid))
        .orderBy(desc(energyReadings.recordedAt))
        .limit(200);

    } catch (dbErr: any) {
      const wasOnline = !isDatabaseOffline;
      markDatabaseOffline();
      if (wasOnline) {
        console.info("Database not connected for dashboard load; loading memory states seamlessly.");
      }
      const mockSummaries = inMemoryDailySummary.get(user.uid) || [];
      mockSummaries.forEach((s) => {
        monthKwh += parseFloat(s.totalKwh);
        monthCarbon += parseFloat(s.totalCarbonKg);
      });

      monthKwh += todayLiveKwh;

      activeSettings = inMemorySettings.get(user.uid) || {
        carbonEmissionFactor: "0.596",
        carbonDailyLimitKg: "3.0",
        powerLimitWatts: "3000.0",
      };

      const emissionFactor = parseFloat(activeSettings.carbonEmissionFactor);
      monthCarbon += (todayLiveKwh * emissionFactor);

      historicReadingsToday = inMemoryEnergyReadings.get(user.uid) || [];
    }

    const emissionFactor = parseFloat(activeSettings.carbonEmissionFactor);
    let peakWattsToday = liveWatts;
    let avgWattsSum = 0;

    historicReadingsToday.forEach((r) => {
      const w = parseFloat(r.watts);
      if (w > peakWattsToday) peakWattsToday = w;
      avgWattsSum += w;
    });

    const avgWattsToday = historicReadingsToday.length > 0 
      ? (avgWattsSum / historicReadingsToday.length) 
      : liveWatts;

    res.json({
      success: true,
      data: {
        live: {
          switchState: status.switch_1,
          watts: liveWatts,
          voltage: status.cur_voltage / 10,
          currentMa: status.cur_current,
          kwhToday: todayLiveKwh,
          carbonKgToday: todayLiveKwh * emissionFactor,
        },
        stats: {
          peakWattsToday: Number(peakWattsToday.toFixed(1)),
          avgWattsToday: Number(avgWattsToday.toFixed(1)),
          currentMonthKwh: Number(monthKwh.toFixed(4)),
          currentMonthCarbonKg: Number(monthCarbon.toFixed(4)),
          dailyCarbonCeiling: parseFloat(activeSettings.carbonDailyLimitKg),
          powerLimitWatts: parseFloat(activeSettings.powerLimitWatts),
        }
      }
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Group 4: Device Automation Scheduling
router.get("/schedules", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let list: any[] = [];

    try {
      list = await db
        .select()
        .from(schedules)
        .where(eq(schedules.userId, user.uid))
        .orderBy(schedules.timeOfDay);
    } catch (err) {
      list = inMemorySchedules.get(user.uid) || [];
    }

    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/schedules", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { label, action, cronExpression, days, timeOfDay } = req.body;

    if (!label || !action || !days || !timeOfDay) {
      return res.status(400).json({ success: false, error: "Missing required schedule fields." });
    }

    let returnedRecord: any = null;
    try {
      const value = await db.insert(schedules).values({
        userId: user.uid,
        label,
        action,
        cronExpression: cronExpression || "* * * * *",
        days,
        timeOfDay,
        isActive: true,
      }).returning();
      returnedRecord = value[0];
    } catch (dbErr: any) {
      if (!inMemorySchedules.has(user.uid)) {
        inMemorySchedules.set(user.uid, []);
      }
      const list = inMemorySchedules.get(user.uid)!;
      returnedRecord = {
        id: Math.floor(Math.random() * 100000),
        userId: user.uid,
        label,
        action,
        cronExpression: cronExpression || "* * * * *",
        days,
        timeOfDay,
        isActive: true,
        createdAt: new Date(),
      };
      list.push(returnedRecord);
    }

    res.json({ success: true, data: returnedRecord });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/schedules/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const scheduleId = parseInt(req.params.id!);
    const { isActive, label, action, days, timeOfDay } = req.body;

    let updatedRecord: any = null;
    try {
      const current = await db
        .select()
        .from(schedules)
        .where(and(eq(schedules.id, scheduleId), eq(schedules.userId, user.uid)))
        .limit(1);

      if (!current[0]) {
        return res.status(404).json({ success: false, error: "Target schedule not found." });
      }

      const updated = await db
        .update(schedules)
        .set({
          isActive: typeof isActive === "boolean" ? isActive : current[0].isActive,
          label: label || current[0].label,
          action: action || current[0].action,
          days: days || current[0].days,
          timeOfDay: timeOfDay || current[0].timeOfDay,
        })
        .where(eq(schedules.id, scheduleId))
        .returning();

      updatedRecord = updated[0];

    } catch (dbErr: any) {
      const list = inMemorySchedules.get(user.uid) || [];
      const index = list.findIndex(s => s.id === scheduleId);
      if (index === -1) {
        return res.status(404).json({ success: false, error: "Target schedule not found." });
      }
      const currentSched = list[index];
      updatedRecord = {
        ...currentSched,
        isActive: typeof isActive === "boolean" ? isActive : currentSched.isActive,
        label: label || currentSched.label,
        action: action || currentSched.action,
        days: days || currentSched.days,
        timeOfDay: timeOfDay || currentSched.timeOfDay,
      };
      list[index] = updatedRecord;
    }

    res.json({ success: true, data: updatedRecord });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/schedules/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const scheduleId = parseInt(req.params.id!);

    let deletedCount = 0;
    try {
      const deleted = await db
        .delete(schedules)
        .where(and(eq(schedules.id, scheduleId), eq(schedules.userId, user.uid)))
        .returning();
      deletedCount = deleted.length;
    } catch (dbErr: any) {
      const list = inMemorySchedules.get(user.uid) || [];
      const index = list.findIndex(s => s.id === scheduleId);
      if (index !== -1) {
        list.splice(index, 1);
        deletedCount = 1;
      }
    }

    if (deletedCount === 0) {
      return res.status(404).json({ success: false, error: "Schedule either not found or user unauthorized." });
    }

    res.json({ success: true, message: "Schedule deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Group 5: Progressive Bill Forecast
router.get("/bill/predict", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    
    // Sum current cumulative kwh this month to calculate prediction
    const status = await getDeviceStatus();
    const liveKwhToday = status.add_ele;

    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    let monthKwh = liveKwhToday;

    try {
      const daySummaries = await db
        .select()
        .from(dailySummary)
        .where(
          and(
            eq(dailySummary.userId, user.uid),
            like(dailySummary.date, `${currentMonthPrefix}%`)
          )
        );

      daySummaries.forEach((s) => {
        monthKwh += parseFloat(s.totalKwh);
      });
    } catch (dbErr: any) {
      const mockSummaries = inMemoryDailySummary.get(user.uid) || [];
      mockSummaries.forEach((s) => {
        monthKwh += parseFloat(s.totalKwh);
      });
    }

    const result = await getBillPrediction(user.uid, monthKwh);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Group 6: Safety Alarms
router.get("/alarms", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let list: any[] = [];

    try {
      list = await db
        .select()
        .from(alarms)
        .where(eq(alarms.userId, user.uid))
        .orderBy(desc(alarms.createdAt));
    } catch (err) {
      list = inMemoryAlarms.get(user.uid) || [];
    }

    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/alarms/history", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let list: any[] = [];

    try {
      list = await db
        .select()
        .from(alarmEvents)
        .where(eq(alarmEvents.userId, user.uid))
        .orderBy(desc(alarmEvents.firedAt))
        .limit(40);
    } catch (err) {
      list = inMemoryAlarmEvents.get(user.uid) || [];
    }

    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/alarms", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { type, threshold, unit, notifyPush } = req.body;

    if (!type || !threshold || !unit) {
      return res.status(400).json({ success: false, error: "Missing required alarm parameters." });
    }

    let returnedRecord: any = null;
    try {
      const value = await db.insert(alarms).values({
        userId: user.uid,
        type,
        threshold,
        unit,
        notifyPush: typeof notifyPush === "boolean" ? notifyPush : true,
        isActive: true,
      }).returning();
      returnedRecord = value[0];
    } catch (dbErr: any) {
      if (!inMemoryAlarms.has(user.uid)) {
        inMemoryAlarms.set(user.uid, []);
      }
      const list = inMemoryAlarms.get(user.uid)!;
      returnedRecord = {
        id: Math.floor(Math.random() * 100000),
        userId: user.uid,
        type,
        threshold,
        unit,
        notifyPush: typeof notifyPush === "boolean" ? notifyPush : true,
        isActive: true,
        createdAt: new Date(),
      };
      list.push(returnedRecord);
    }

    res.json({ success: true, data: returnedRecord });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/alarms/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const alarmId = parseInt(req.params.id!);
    const { isActive, threshold } = req.body;

    let updatedRecord: any = null;
    try {
      const current = await db
        .select()
        .from(alarms)
        .where(and(eq(alarms.id, alarmId), eq(alarms.userId, user.uid)))
        .limit(1);

      if (!current[0]) {
        return res.status(404).json({ success: false, error: "Alarm condition not found." });
      }

      const updated = await db
        .update(alarms)
        .set({
          isActive: typeof isActive === "boolean" ? isActive : current[0].isActive,
          threshold: threshold || current[0].threshold,
        })
        .where(eq(alarms.id, alarmId))
        .returning();

      updatedRecord = updated[0];

    } catch (dbErr: any) {
      const list = inMemoryAlarms.get(user.uid) || [];
      const index = list.findIndex(a => a.id === alarmId);
      if (index === -1) {
        return res.status(404).json({ success: false, error: "Alarm condition not found." });
      }
      const currentAlarm = list[index];
      updatedRecord = {
        ...currentAlarm,
        isActive: typeof isActive === "boolean" ? isActive : currentAlarm.isActive,
        threshold: threshold || currentAlarm.threshold,
      };
      list[index] = updatedRecord;
    }

    res.json({ success: true, data: updatedRecord });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/alarms/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const alarmId = parseInt(req.params.id!);

    let deletedCount = 0;
    try {
      const deleted = await db
        .delete(alarms)
        .where(and(eq(alarms.id, alarmId), eq(alarms.userId, user.uid)))
        .returning();
      deletedCount = deleted.length;
    } catch (dbErr: any) {
      const list = inMemoryAlarms.get(user.uid) || [];
      const index = list.findIndex(a => a.id === alarmId);
      if (index !== -1) {
        list.splice(index, 1);
        deletedCount = 1;
      }
    }

    if (deletedCount === 0) {
      return res.status(404).json({ success: false, error: "Alarm limit not found or unauthorized." });
    }

    res.json({ success: true, message: "Alarm condition deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Group 7: Weather-Aware Controls
router.get("/weather/current", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const metrics = await getLatestWeather();
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/weather/rules", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let list: any[] = [];

    try {
      list = await db
        .select()
        .from(weatherRules)
        .where(eq(weatherRules.userId, user.uid))
        .orderBy(weatherRules.id);
    } catch (err) {
      list = inMemoryWeatherRules.get(user.uid) || [];
    }

    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/weather/logs", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let logs: any[] = [];

    try {
      logs = await db
        .select()
        .from(weatherLogs)
        .where(eq(weatherLogs.userId, user.uid))
        .orderBy(desc(weatherLogs.firedAt))
        .limit(10);
    } catch (err) {
      logs = inMemoryWeatherLogs.get(user.uid) || [];
    }

    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/weather/rules", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { condition, threshold, action, label } = req.body;

    if (!condition || !threshold || !action || !label) {
      return res.status(400).json({ success: false, error: "Missing climate automation parameters." });
    }

    let returnedRecord: any = null;
    try {
      const rule = await db.insert(weatherRules).values({
        userId: user.uid,
        condition,
        threshold,
        action,
        label,
        isActive: true,
      }).returning();
      returnedRecord = rule[0];
    } catch (dbErr: any) {
      if (!inMemoryWeatherRules.has(user.uid)) {
        inMemoryWeatherRules.set(user.uid, []);
      }
      const list = inMemoryWeatherRules.get(user.uid)!;
      returnedRecord = {
        id: Math.floor(Math.random() * 100000),
        userId: user.uid,
        condition,
        threshold,
        action,
        label,
        isActive: true,
      };
      list.push(returnedRecord);
    }

    res.json({ success: true, data: returnedRecord });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/weather/rules/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const ruleId = parseInt(req.params.id!);

    let deletedCount = 0;
    try {
      const deleted = await db
        .delete(weatherRules)
        .where(and(eq(weatherRules.id, ruleId), eq(weatherRules.userId, user.uid)))
        .returning();
      deletedCount = deleted.length;
    } catch (dbErr: any) {
      const list = inMemoryWeatherRules.get(user.uid) || [];
      const index = list.findIndex(r => r.id === ruleId);
      if (index !== -1) {
        list.splice(index, 1);
        deletedCount = 1;
      }
    }

    if (deletedCount === 0) {
      return res.status(404).json({ success: false, error: "Rule not found or unauthorized." });
    }

    res.json({ success: true, message: "Weather condition deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Group 8: Tariff and Application Slabs Configuration
router.get("/settings", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let config: any = null;

    try {
      const queryResult = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, user.uid))
        .limit(1);
      config = queryResult[0];
    } catch (err) {
      config = inMemorySettings.get(user.uid) || {
        userId: user.uid,
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
      };
    }

    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/settings", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const updates = req.body;

    let returnedConfig: any = null;
    try {
      const result = await db
        .insert(settings)
        .values({
          userId: user.uid,
          ...updates,
        })
        .onConflictDoUpdate({
          target: settings.userId,
          set: updates,
        })
        .returning();
      returnedConfig = result[0];
    } catch (dbErr: any) {
      const currentConfig = inMemorySettings.get(user.uid) || {
        userId: user.uid,
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
      };
      
      returnedConfig = {
        ...currentConfig,
        ...updates
      };
      inMemorySettings.set(user.uid, returnedConfig);
    }

    res.json({ success: true, data: returnedConfig });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
