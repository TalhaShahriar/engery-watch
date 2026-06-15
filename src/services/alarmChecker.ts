import { db } from "../db/index.ts";
import { alarms, alarmEvents } from "../db/schema.ts";
import { eq, and } from "drizzle-orm";
import { inMemoryAlarms, inMemoryAlarmEvents } from "../db/memdb.ts";

interface ActiveReading {
  watts: number;
  voltage: number;
  currentMa: number;
  kwhToday: number;
  carbonKg: number;
}

// In-memory throttling structure: Key format userId-alarmId => Timestamp Milliseconds
const lastFiredAlarms = new Map<string, number>();

/**
 * Sweeps all active user alarms against the latest smart plug telemetry readings
 * @param userId Firebase UID
 * @param reading Current reading properties from the poller
 * @param ioEventEmitter Socket.IO server reference to emit alarms immediately
 */
export async function checkAlarms(userId: string, reading: ActiveReading, ioEventEmitter: any): Promise<void> {
  try {
    let activeAlarms: any[] = [];
    try {
      activeAlarms = await db
        .select()
        .from(alarms)
        .where(and(eq(alarms.userId, userId), eq(alarms.isActive, true)));
    } catch (err) {
      // Database is offline; fall back to in-memory active alarms
      const allAlarms = inMemoryAlarms.get(userId) || [];
      activeAlarms = allAlarms.filter(a => a.isActive === true);
    }

    const throttleTimeMs = 10 * 60 * 1000; // 10 minutes throttling

    for (const alarm of activeAlarms) {
      let isTripped = false;
      let currentValue = 0;
      let message = "";

      const threshold = parseFloat(alarm.threshold);

      if (alarm.type === "power_limit") {
        isTripped = reading.watts >= threshold;
        currentValue = reading.watts;
        message = `Smart plug power draw of ${reading.watts}W crossed your safe limit of ${threshold}W!`;
      } else if (alarm.type === "carbon_limit") {
        isTripped = reading.carbonKg >= threshold;
        currentValue = reading.carbonKg;
        message = `Today's carbon emission of ${reading.carbonKg.toFixed(3)}kg has exceeded your limit of ${threshold}kg!`;
      }

      if (isTripped) {
        const throttleKey = `${userId}-${alarm.id}`;
        const lastFired = lastFiredAlarms.get(throttleKey);

        if (!lastFired || Date.now() - lastFired > throttleTimeMs) {
          lastFiredAlarms.set(throttleKey, Date.now());

          // 1. Insert incident log into PostgreSQL alarm_events with in-memory fallback
          let eventId = Date.now();
          try {
            const eventResult = await db.insert(alarmEvents).values({
              userId,
              alarmId: alarm.id,
              valueAtTrigger: currentValue.toString(),
              message,
            }).returning();
            if (eventResult[0]) {
              eventId = eventResult[0].id;
            }
          } catch (dbErr: any) {
            if (!inMemoryAlarmEvents.has(userId)) {
              inMemoryAlarmEvents.set(userId, []);
            }
            const mEvents = inMemoryAlarmEvents.get(userId)!;
            eventId = Math.floor(Math.random() * 100000);
            mEvents.push({
              id: eventId,
              userId,
              alarmId: alarm.id,
              firedAt: new Date().toISOString(),
              valueAtTrigger: currentValue.toString(),
              message,
            });
            // trim to 100 logs
            if (mEvents.length > 100) mEvents.shift();
          }

          // 2. Push real-time alert through Socket.IO
          if (ioEventEmitter) {
            ioEventEmitter.emit("alarm:fired", {
              eventId,
              userId,
              alarmId: alarm.id,
              type: alarm.type,
              threshold,
              currentValue,
              message,
              firedAt: new Date().toISOString(),
            });
          }
          console.log(`Alarm triggered: [${alarm.type}] ${message}`);
        }
      }
    }
  } catch (error) {
    console.error("Failed to run alarm safety inspector:", error);
  }
}
