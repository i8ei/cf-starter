import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sessions } from "../db/schema";
import type { AppContextEnv } from "../types";
import { getSessionCookie } from "../lib/session";
import { getUserRoleNames } from "../lib/rbac";

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

  const roles = await getUserRoleNames(db, session.userId);
  c.set("userId", session.userId);
  c.set("roles", roles);
  await next();
});
