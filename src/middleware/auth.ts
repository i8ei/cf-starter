import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { member } from "../db/schema";
import type { AppContextEnv, UserRole, OrgRole } from "../types";
import { getSessionCookie } from "../lib/session";
import { jsonError } from "../lib/http";
import { resolveAuthMode } from "../lib/auth-mode";
import { verifyAdminSessionToken } from "../lib/simple-admin-session";
import { createAuth } from "../lib/better-auth";

export const requireAuth = createMiddleware<AppContextEnv>(async (c, next) => {
  const mode = resolveAuthMode(c.env);

  if (mode === "none") {
    c.set("userId", "1");
    c.set("orgId", "default-org");
    c.set("roles", []);
    c.set("orgRole", "owner");
    await next();
    return;
  }

  if (mode === "simple-admin") {
    const token = getSessionCookie(c);
    if (!token || !c.env.ADMIN_PASSWORD) {
      return jsonError(c, 401, "unauthorized", "Authentication required");
    }
    const valid = await verifyAdminSessionToken(token, c.env.ADMIN_PASSWORD);
    if (!valid) {
      return jsonError(c, 401, "unauthorized", "Authentication required");
    }
    c.set("userId", "1");
    c.set("orgId", "default-org");
    c.set("roles", ["admin"]);
    c.set("orgRole", "admin");
    await next();
    return;
  }

  // better-auth mode: validate session via Better Auth
  const auth = createAuth(c.env);
  const result = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!result) {
    return jsonError(c, 401, "unauthorized", "Authentication required");
  }

  const userId = result.user.id;
  const userRecord = result.user as Record<string, unknown>;
  const userRole = (userRecord.role as UserRole) ?? "user";
  const activeOrgId = (result.session as Record<string, unknown>).activeOrganizationId as string | null;

  // Check if user is banned (admin plugin)
  if (userRecord.banned) {
    return jsonError(c, 403, "banned", "Account is suspended");
  }

  c.set("sessionId", result.session.id);
  c.set("userId", userId);
  c.set("roles", [userRole]);

  if (activeOrgId) {
    // Look up member role for active org
    const db = drizzle(c.env.DB);
    const [memberRow] = await db
      .select({ role: member.role })
      .from(member)
      .where(and(
        eq(member.organizationId, activeOrgId),
        eq(member.userId, userId)
      ))
      .limit(1);

    if (memberRow) {
      c.set("orgId", activeOrgId);
      c.set("orgRole", memberRow.role as OrgRole);
    }
    // else: activeOrgId is stale (user removed from org) — orgId stays undefined
  }
  // orgId/orgRole may be undefined when no active org is set.
  // Routes requiring org context use requireOrgRole() which checks for this.

  await next();
});
