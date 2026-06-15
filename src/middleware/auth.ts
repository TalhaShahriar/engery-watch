import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, isDatabaseOffline, markDatabaseOffline } from "../db/index.ts";
import { users, settings } from "../db/schema.ts";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "energywatch_bd_secret_key_2026_dhaka";

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
  };
}

// Global In-Memory Store for fallback when PostgreSQL database is offline or not running in dev sandbox
import { inMemoryUsers, inMemorySettings, syncUserInMemory } from "../db/memdb.ts";

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; email: string };
    const userUid = decoded.uid;
    const userEmail = decoded.email;

    try {
      if (isDatabaseOffline) {
        throw new Error("Preemptive offline fallback enabled.");
      }

      // 1. Sync User with local DB if DB is accessible
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.uid, userUid))
        .limit(1);

      if (existingUser.length === 0) {
        // If they exist in JWT but somehow missing in DB, insert them
        await db.insert(users).values({
          uid: userUid,
          email: userEmail,
        }).onConflictDoNothing();
      }

      // Ensure they have default settings in the database
      await db.insert(settings)
        .values({
          userId: userUid,
        })
        .onConflictDoNothing();

    } catch (dbErr: any) {
      markDatabaseOffline();
      // Fallback: Store locally in-memory so app continues working
      syncUserInMemory(userUid, userEmail);
    }

    req.user = {
      uid: userUid,
      email: userEmail,
    };
    next();
  } catch (error) {
    console.error("Error verifying JWT token:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};
