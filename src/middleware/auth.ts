import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sessions } from "../db/schema";
import type { AppContextEnv } from "../types";
import { getSessionCookie } from "../lib/session";

export const requireAuth = createMiddleware<AppContextEnv>(async (c, next) => {
  const sessionId = getSessionCookie(c);
  if (!sessionId) return c.json({ error: "unauthorized" }, 401);

  const db = drizzle(c.env.DB);
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session || session.expiresAt < new Date().toISOString()) {
    return c.json({ error: "unauthorized" }, 401);
  }

  c.set("userId", session.userId);
  await next();
});
