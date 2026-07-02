import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { user } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import type { AppContextEnv } from "../../types";
import {
  HOST_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  resolveCookieOptions,
} from "../../lib/session";
import { writeAuditLog } from "../../lib/audit";
import { jsonError } from "../../lib/http";
import { resolveAuthMode } from "../../lib/auth-mode";
import { createAuth } from "../../lib/better-auth";

const app = new Hono<AppContextEnv>()
  .post("/logout", requireAuth, async (c) => {
    const mode = resolveAuthMode(c.env);
    const { sameSite, secure } = resolveCookieOptions(c.env);

    if (mode === "better-auth") {
      const auth = createAuth(c.env);
      try {
        await auth.api.signOut({ headers: c.req.raw.headers });
      } catch {
        // Best-effort sign out
      }
      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
        organizationId: c.get("orgId") ?? null,
        action: "auth.logout",
        resourceType: "session",
        status: 200,
      });
    }

    // Clear all possible session cookies. Better Auth prefixes its cookie
    // with __Secure- when cookies are Secure, so both names must be cleared.
    deleteCookie(c, HOST_SESSION_COOKIE_NAME, { path: "/", sameSite, secure: true });
    deleteCookie(c, LEGACY_SESSION_COOKIE_NAME, { path: "/", sameSite, secure });
    deleteCookie(c, "ba.session_token", { path: "/", sameSite, secure });
    deleteCookie(c, "__Secure-ba.session_token", { path: "/", sameSite, secure: true });

    return c.json({ ok: true });
  })
  .get("/me", requireAuth, async (c) => {
    const mode = resolveAuthMode(c.env);
    const userId = c.get("userId");

    if (!userId) {
      return jsonError(c, 401, "unauthorized", "Authentication required");
    }

    if (mode === "none") {
      return c.json({
        id: "1",
        email: "anonymous@localhost",
        name: "Anonymous",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        roles: [],
        currentOrganizationId: "default-org",
        organizationRole: "owner",
      });
    }

    if (mode === "simple-admin") {
      return c.json({
        id: "1",
        email: "admin@localhost",
        name: "Admin",
        emailVerified: false,
        createdAt: new Date().toISOString(),
        roles: ["admin"],
        currentOrganizationId: "default-org",
        organizationRole: "admin",
      });
    }

    // better-auth mode
    const db = drizzle(c.env.DB);
    const roles = c.get("roles") ?? [];
    const currentOrganizationId = c.get("orgId") ?? null;
    const organizationRole = c.get("orgRole") ?? null;

    const [found] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!found) {
      return jsonError(c, 404, "not_found", "User not found");
    }

    return c.json({
      id: found.id,
      email: found.email,
      name: found.name,
      emailVerified: !!found.emailVerified,
      createdAt: found.createdAt instanceof Date ? found.createdAt.toISOString() : String(found.createdAt),
      roles,
      currentOrganizationId,
      organizationRole,
    });
  });

export default app;
