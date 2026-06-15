import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

export let isDatabaseOffline = !process.env.SQL_HOST || !process.env.SQL_DB_NAME;

export function markDatabaseOffline() {
  if (!isDatabaseOffline) {
    console.warn("Database connection is offline or unprovisioned. Switching to in-memory fallback store seamlessly.");
    isDatabaseOffline = true;
  }
}

export const createPool = () => {
  return new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    connectionTimeoutMillis: 5000, // Faster timeout since we fall back anyway
  });
};

const pool = createPool();

pool.on("error", (err) => {
  console.warn("Idle SQL pool client encountered an error; marking database offline:", err.message);
  markDatabaseOffline();
});

export const db = drizzle(pool, { schema });
export { schema };
