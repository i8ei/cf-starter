import { drizzle } from "drizzle-orm/d1";
import { lt } from "drizzle-orm";
import { session } from "./schema";

export async function purgeExpiredSessions(dbBinding: D1Database): Promise<number> {
  const db = drizzle(dbBinding);
  const now = new Date();
  const result = await db.delete(session).where(lt(session.expiresAt, now));
  return Number(result.meta.changes ?? 0);
}
