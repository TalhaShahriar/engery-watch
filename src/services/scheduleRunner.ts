import cron from "node-cron";
import { db } from "../db/index.ts";
import { schedules } from "../db/schema.ts";
import { toggleDevice } from "./tuyaService.ts";
import { eq } from "drizzle-orm";
import { inMemorySchedules } from "../db/memdb.ts";

let schedulerCronJob: any = null;

/**
 * Checks and deploys timed actions defined in active schedules.
 * Runs once every minute.
 */
export function startScheduleRunner(io: any) {
  schedulerCronJob = cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      // Adjust to Bangladesh local time if server is UTC. 
      // JavaScript Date handles timezone offsets nicely, let's get the target Asia/Dhaka time.
      const dhakaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
      
      const currentDay = dhakaTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const hours = String(dhakaTime.getHours()).padStart(2, "0");
      const minutes = String(dhakaTime.getMinutes()).padStart(2, "0");
      const currentHHMM = `${hours}:${minutes}`;

      // Fetch all active schedules with robust database connection fallback
      let activeSchedules: any[] = [];
      try {
        activeSchedules = await db
          .select()
          .from(schedules)
          .where(eq(schedules.isActive, true));
      } catch (err) {
        // Fallback: Gather all in-memory scheduled tasks
        const allLists = Array.from(inMemorySchedules.values());
        activeSchedules = allLists.flat().filter(s => s.isActive === true);
      }

      for (const sched of activeSchedules) {
        // Check if current day of week is supported in sched.days array
        const daysArray: number[] = typeof sched.days === "string" ? JSON.parse(sched.days) : sched.days;
        const matchesDay = daysArray ? daysArray.includes(currentDay) : true;
        
        // Matches the target time
        const matchesTime = sched.timeOfDay === currentHHMM;

        if (matchesDay && matchesTime) {
          console.log(`Executing schedule: [${sched.label}] -> Action: ${sched.action}`);
          const isTurnOn = sched.action === "on";
          
          const success = await toggleDevice(isTurnOn);
          if (success) {
            // Broadcast schedule trigger through Socket.IO to instantly update the UI switch toggles!
            if (io) {
              io.to(sched.userId).emit("schedule:triggered", {
                userId: sched.userId,
                scheduleId: sched.id,
                label: sched.label,
                action: sched.action,
                time: currentHHMM,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Scheduler alarm driver met an unexpected error:", error);
    }
  });

  console.log("Minute-by-minute schedule runner loaded.");
}

export function stopScheduleRunner() {
  if (schedulerCronJob) {
    schedulerCronJob.stop();
  }
}
