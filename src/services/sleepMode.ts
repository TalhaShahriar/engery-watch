import { db } from "../db/index.ts";
import { settings } from "../db/schema.ts";
import { eq } from "drizzle-orm";
import { inMemorySettings } from "../db/memdb.ts";

interface SleepState {
  startIdleTime: number | null; // Timestamp representing when the low draw started
  isAsleep: boolean;
}

const userSleepSessions = new Map<string, SleepState>();

/**
 * Sweeps telemetry against sleep configs to detect inactive standby loads.
 * @param userId Firebase User UID
 * @param watts Current watt power draw
 * @param ioEventEmitter Socket.IO server reference to alert frontend
 * @returns boolean representing if the system is currently asleep
 */
export async function trackSleepMode(userId: string, watts: number, ioEventEmitter: any): Promise<boolean> {
  try {
    // Fetch sleep preference parameters with robust database fallback
    let usersSettings: any[] = [];
    try {
      usersSettings = await db
        .select()
        .from(settings)
        .where(eq(settings.userId, userId))
        .limit(1);
    } catch (err) {
      const mSettings = inMemorySettings.get(userId);
      usersSettings = mSettings ? [mSettings] : [];
    }

    const config = usersSettings[0] || {
      sleepIdleThresholdWatts: "5.0",
      sleepIdleMinutes: 30,
    };

    const threshold = parseFloat(config.sleepIdleThresholdWatts);
    const idleSecondsLimit = config.sleepIdleMinutes * 60;

    let session = userSleepSessions.get(userId);
    if (!session) {
      session = { startIdleTime: null, isAsleep: false };
      userSleepSessions.set(userId, session);
    }

    // Checking of power draw bounds
    if (watts > 0 && watts <= threshold) {
      // Current wattage is below the cutoff
      if (session.startIdleTime === null) {
        session.startIdleTime = Date.now(); // Start tracking idle
      } else {
        const elapsedSeconds = (Date.now() - session.startIdleTime) / 1000;
        
        if (elapsedSeconds >= idleSecondsLimit && !session.isAsleep) {
          session.isAsleep = true;
          // Emit WebSocket event 'device:sleep'
          if (ioEventEmitter) {
            ioEventEmitter.emit("device:sleep", {
              userId,
              since: new Date(session.startIdleTime).toISOString(),
              message: `Device has entered sleep mode (drawing ${watts}W < ${threshold}W for ${config.sleepIdleMinutes} minutes). Polling cycle throttled.`,
            });
          }
          console.log(`User ${userId} smart plug has entered low power Sleep Mode.`);
        }
      }
    } else {
      // Device drawing active load or is entirely switched off (0W is handled safely, but can toggle awake if previously sleeping)
      if (session.isAsleep) {
        session.isAsleep = false;
        session.startIdleTime = null;
        // Emit WebSocket event 'device:awake'
        if (ioEventEmitter) {
          ioEventEmitter.emit("device:awake", {
            userId,
            watts,
            message: `Device awake! Power consumption has increased to ${watts}W. Standard polling cycle restored.`,
          });
        }
        console.log(`User ${userId} smart plug has awakened from Sleep Mode with a workload of ${watts}W.`);
      } else {
        // Reset idle timer if draw goes normal
        session.startIdleTime = null;
      }
    }

    return session.isAsleep;
  } catch (error) {
    console.error("Failed to run sleep standby detective:", error);
    return false;
  }
}

/**
 * Manually resets or forces sleep state changes
 */
export function clearSleepSession(userId: string) {
  userSleepSessions.delete(userId);
}
