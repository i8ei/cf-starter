import { drizzle } from "drizzle-orm/d1";
import { lt } from "drizzle-orm";
import { sessions } from "./schema";

export async function purgeExpiredSessions(dbBinding: D1Database): Promise<number> {
  const db = drizzle(dbBinding);
  const now = new Date().toISOString();
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, now));
  return Number(result.meta.changes ?? 0);
}
