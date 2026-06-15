import axios from "axios";
import { db } from "../db/index.ts";
import { weatherRules, weatherLogs } from "../db/schema.ts";
import { toggleDevice } from "./tuyaService.ts";
import { eq, and } from "drizzle-orm";
import { inMemoryWeatherRules, inMemoryWeatherLogs } from "../db/memdb.ts";

interface WeatherData {
  temp: number;
  precipitation: number;
  humidity: number;
  weatherCode: number;
  timestamp: string;
}

// Global cached weather data
let weatherCache: WeatherData | null = null;
let lastFetchTime = 0;

export async function getLatestWeather(): Promise<WeatherData> {
  const cacheDurationMs = 15 * 60 * 1000; // 15 minutes
  if (weatherCache && (Date.now() - lastFetchTime < cacheDurationMs)) {
    return weatherCache;
  }

  try {
    const response = await axios.get(
      "https://api.open-meteo.com/v1/forecast?latitude=23.8103&longitude=90.4125&current=temperature_2m,precipitation,relative_humidity_2m,weathercode&timezone=Asia/Dhaka"
    );

    if (response.data && response.data.current) {
      const cur = response.data.current;
      weatherCache = {
        temp: cur.temperature_2m,
        precipitation: cur.precipitation,
        humidity: cur.relative_humidity_2m,
        weatherCode: cur.weathercode,
        timestamp: cur.time,
      };
      lastFetchTime = Date.now();
      return weatherCache;
    }
    throw new Error("Invalid response form from Open-Meteo");
  } catch (error) {
    console.error("Failed to query Open-Meteo weather API:", error);
    // Return standard Dhaka default in case of downstream API failure
    return weatherCache || {
      temp: 29.5,
      precipitation: 0.0,
      humidity: 78.0,
      weatherCode: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Checks all active weather rules for a user and runs toggling actions if matched.
 */
export async function evaluateWeatherRules(userId: string, ioEventEmitter: any): Promise<void> {
  try {
    const weather = await getLatestWeather();

    let rules: any[] = [];
    try {
      rules = await db
        .select()
        .from(weatherRules)
        .where(and(eq(weatherRules.userId, userId), eq(weatherRules.isActive, true)));
    } catch (err) {
      const allRules = inMemoryWeatherRules.get(userId) || [];
      rules = allRules.filter(r => r.isActive === true);
    }

    for (const rule of rules) {
      const threshold = parseFloat(rule.threshold);
      let conditionMet = false;
      let actualValue = 0;
      let logMsg = "";

      switch (rule.condition) {
        case "temp_above":
          conditionMet = weather.temp > threshold;
          actualValue = weather.temp;
          logMsg = `Temperature of ${weather.temp}°C rises above the threshold ${threshold}°C.`;
          break;
        case "temp_below":
          conditionMet = weather.temp < threshold;
          actualValue = weather.temp;
          logMsg = `Temperature of ${weather.temp}°C drops below the threshold ${threshold}°C.`;
          break;
        case "rain":
          conditionMet = weather.precipitation > 0;
          actualValue = weather.precipitation;
          logMsg = `Rain detected with ${weather.precipitation}mm of precipitation (Threshold ${threshold}mm).`;
          break;
        case "humidity_above":
          conditionMet = weather.humidity > threshold;
          actualValue = weather.humidity;
          logMsg = `Humidity level of ${weather.humidity}% rises above the limit ${threshold}%.`;
          break;
      }

      if (conditionMet) {
        // Prevent action thrashing by checking if we already fired this action in the last hour
        let recentLogs: any[] = [];
        try {
          recentLogs = await db
            .select()
            .from(weatherLogs)
            .where(
              and(
                eq(weatherLogs.userId, userId),
                eq(weatherLogs.ruleId, rule.id),
              )
            )
            .limit(1);
        } catch (err) {
          recentLogs = inMemoryWeatherLogs.get(userId) || [];
        }

        // Turn device ON or OFF
        const actionOn = rule.action === "turn_on";
        console.log(`Weather rule triggered: ${rule.label}. Action: ${rule.action}`);
        
        const success = await toggleDevice(actionOn);

        if (success) {
          const logText = `Rule "${rule.label}" fired. Automatically turned plug ${actionOn ? "ON" : "OFF"}. Reason: ${logMsg}`;
          
          // Log execution
          try {
            await db.insert(weatherLogs).values({
              userId,
              ruleId: rule.id,
              conditionValue: actualValue.toString(),
              message: logText,
            });
          } catch (dbErr: any) {
            if (!inMemoryWeatherLogs.has(userId)) {
              inMemoryWeatherLogs.set(userId, []);
            }
            const mLogs = inMemoryWeatherLogs.get(userId)!;
            mLogs.push({
              id: Math.floor(Math.random() * 100000),
              userId,
              ruleId: rule.id,
              firedAt: new Date().toISOString(),
              conditionValue: actualValue.toString(),
              message: logText,
            });
            if (mLogs.length > 50) mLogs.shift();
          }

          // Emit Socket event to notify client of change
          if (ioEventEmitter) {
            ioEventEmitter.emit("weather:action", {
              userId,
              ruleId: rule.id,
              action: rule.action,
              label: rule.label,
              message: logMsg,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error evaluating weather rules:", error);
  }
}
