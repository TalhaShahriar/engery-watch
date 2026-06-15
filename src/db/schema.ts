import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp, boolean, numeric, uniqueIndex } from "drizzle-orm/pg-core";

// Users table with unique UID as the primary key
export const users = pgTable("users", {
  uid: text("uid").primaryKey(), // User UID (custom or unique string)
  email: text("email").notNull(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Energy readings written every 30 seconds (or more frequently) by poller
export const energyReadings = pgTable("energy_readings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  watts: numeric("watts", { precision: 8, scale: 2 }).notNull(),
  voltage: numeric("voltage", { precision: 6, scale: 2 }).notNull(),
  currentMa: integer("current_ma").notNull(),
  kwhToday: numeric("kwh_today", { precision: 8, scale: 4 }).notNull(),
  carbonKg: numeric("carbon_kg", { precision: 8, scale: 4 }).notNull(),
});

// Daily summaries written at midnight
export const dailySummary = pgTable("daily_summary", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(), // format YYYY-MM-DD
  totalKwh: numeric("total_kwh", { precision: 8, scale: 4 }).notNull(),
  totalCarbonKg: numeric("total_carbon_kg", { precision: 8, scale: 4 }).notNull(),
  peakWatts: numeric("peak_watts", { precision: 8, scale: 2 }).notNull(),
  avgWatts: numeric("avg_watts", { precision: 8, scale: 2 }).notNull(),
  estimatedBillTaka: numeric("estimated_bill_taka", { precision: 10, scale: 2 }).notNull(),
}, (table) => {
  return [
    uniqueIndex("user_date_idx").on(table.userId, table.date)
  ];
});

// Device schedules
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(),
  action: text("action").notNull(), // 'on' or 'off'
  cronExpression: text("cron_expression").notNull(), // e.g. '* * * * *'
  days: integer("days").array().notNull(), // [0,1,2,3,4,5,6] (0 = Sunday, 1 = Monday, etc.)
  timeOfDay: text("time_of_day").notNull(), // format 'HH:MM'
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Alarms definition
export const alarms = pgTable("alarms", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // 'carbon_limit', 'power_limit', 'idle_alert'
  threshold: numeric("threshold", { precision: 10, scale: 4 }).notNull(),
  unit: text("unit").notNull(), // 'kg', 'W', 'kWh'
  isActive: boolean("is_active").default(true).notNull(),
  notifyPush: boolean("notify_push").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Alarm events history
export const alarmEvents = pgTable("alarm_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  alarmId: integer("alarm_id").references(() => alarms.id, { onDelete: "cascade" }).notNull(),
  firedAt: timestamp("fired_at").defaultNow().notNull(),
  valueAtTrigger: numeric("value_at_trigger", { precision: 10, scale: 4 }).notNull(),
  message: text("message").notNull(),
});

// Weather auto-control rules
export const weatherRules = pgTable("weather_rules", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  condition: text("condition").notNull(), // 'temp_above', 'temp_below', 'rain', 'humidity_above'
  threshold: numeric("threshold", { precision: 6, scale: 2 }).notNull(),
  action: text("action").notNull(), // 'turn_on', 'turn_off'
  label: text("label").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Weather log for historical actions
export const weatherLogs = pgTable("weather_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  ruleId: integer("rule_id").references(() => weatherRules.id, { onDelete: "cascade" }),
  firedAt: timestamp("fired_at").defaultNow().notNull(),
  conditionValue: numeric("condition_value", { precision: 6, scale: 2 }).notNull(),
  message: text("message").notNull(),
});

// App settings per user (single row per user)
export const settings = pgTable("settings", {
  userId: text("user_id").primaryKey().references(() => users.uid, { onDelete: "cascade" }),
  tariffSlab1Limit: numeric("tariff_slab_1_limit", { precision: 8, scale: 2 }).default("75").notNull(),
  tariffSlab1Rate: numeric("tariff_slab_1_rate", { precision: 8, scale: 2 }).default("3.75").notNull(),
  tariffSlab2Limit: numeric("tariff_slab_2_limit", { precision: 8, scale: 2 }).default("200").notNull(),
  tariffSlab2Rate: numeric("tariff_slab_2_rate", { precision: 8, scale: 2 }).default("5.26").notNull(),
  tariffSlab3Limit: numeric("tariff_slab_3_limit", { precision: 8, scale: 2 }).default("300").notNull(),
  tariffSlab3Rate: numeric("tariff_slab_3_rate", { precision: 8, scale: 2 }).default("5.62").notNull(),
  tariffSlab4Limit: numeric("tariff_slab_4_limit", { precision: 8, scale: 2 }).default("400").notNull(),
  tariffSlab4Rate: numeric("tariff_slab_4_rate", { precision: 8, scale: 2 }).default("6.09").notNull(),
  tariffSlab5Rate: numeric("tariff_slab_5_rate", { precision: 8, scale: 2 }).default("9.30").notNull(),
  carbonEmissionFactor: numeric("carbon_emission_factor", { precision: 8, scale: 4 }).default("0.596").notNull(),
  carbonDailyLimitKg: numeric("carbon_daily_limit_kg", { precision: 8, scale: 2 }).default("3.0").notNull(),
  powerLimitWatts: numeric("power_limit_watts", { precision: 8, scale: 2 }).default("3000.0").notNull(),
  sleepIdleThresholdWatts: numeric("sleep_idle_threshold_watts", { precision: 8, scale: 2 }).default("5.0").notNull(),
  sleepIdleMinutes: integer("sleep_idle_minutes").default(30).notNull(),
  weatherAutoEnabled: boolean("weather_auto_enabled").default(true).notNull(),
});

// Relations declarations
export const usersRelations = relations(users, ({ many, one }) => ({
  energyReadings: many(energyReadings),
  dailySummaries: many(dailySummary),
  schedules: many(schedules),
  alarms: many(alarms),
  alarmEvents: many(alarmEvents),
  weatherRules: many(weatherRules),
  settings: one(settings, {
    fields: [users.uid],
    references: [settings.userId],
  }),
}));

export const energyReadingsRelations = relations(energyReadings, ({ one }) => ({
  user: one(users, {
    fields: [energyReadings.userId],
    references: [users.uid],
  }),
}));

export const dailySummaryRelations = relations(dailySummary, ({ one }) => ({
  user: one(users, {
    fields: [dailySummary.userId],
    references: [users.uid],
  }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  user: one(users, {
    fields: [schedules.userId],
    references: [users.uid],
  }),
}));

export const alarmsRelations = relations(alarms, ({ many, one }) => ({
  user: one(users, {
    fields: [alarms.userId],
    references: [users.uid],
  }),
  events: many(alarmEvents),
}));

export const alarmEventsRelations = relations(alarmEvents, ({ one }) => ({
  user: one(users, {
    fields: [alarmEvents.userId],
    references: [users.uid],
  }),
  alarm: one(alarms, {
    fields: [alarmEvents.alarmId],
    references: [alarms.id],
  }),
}));

export const weatherRulesRelations = relations(weatherRules, ({ many, one }) => ({
  user: one(users, {
    fields: [weatherRules.userId],
    references: [users.uid],
  }),
  logs: many(weatherLogs),
}));

export const weatherLogsRelations = relations(weatherLogs, ({ one }) => ({
  user: one(users, {
    fields: [weatherLogs.userId],
    references: [users.uid],
  }),
  rule: one(weatherRules, {
    fields: [weatherLogs.ruleId],
    references: [weatherRules.id],
  }),
}));
