import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { sessions } from "../db/schema";
import type { AppContextEnv } from "../types";
import { getSessionCookie } from "../lib/session";
import { jsonError } from "../lib/http";
import { getUserRoleNames } from "../lib/rbac";

export const requireAuth = createMiddleware<AppContextEnv>(async (c, next) => {
  const sessionId = getSessionCookie(c);
  if (!sessionId) {
    return jsonError(c, 401, "unauthorized", "Authentication required");
  }

  const db = drizzle(c.env.DB);
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session || session.expiresAt < new Date().toISOString()) {
    return jsonError(c, 401, "unauthorized", "Authentication required");
  }

  const roles = await getUserRoleNames(db, session.userId);
  c.set("userId", session.userId);
  c.set("roles", roles);
  await next();
});
