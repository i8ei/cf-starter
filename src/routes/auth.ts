import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users, sessions } from "../db/schema";
import { loginSchema, signupSchema } from "../../shared/schemas/auth";
import { switchOrganizationSchema } from "../../shared/schemas/orgs";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import type { AppContextEnv, Env } from "../types";
import {
  HOST_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  resolveCookieOptions,
  resolveSessionCookieName,
  rotateSession,
  SESSION_MAX_AGE_SECONDS,
} from "../lib/session";
import { writeAuditLog } from "../lib/audit";
import { jsonError } from "../lib/http";
import { logRequestEvent } from "../lib/logging";
import {
  ensurePersonalOrganization,
  getMembershipSummaries,
  setSessionOrganization,
} from "../lib/organizations";
import { ensureDefaultUserRole } from "../lib/rbac";
import { validator } from "../lib/validator";
import { enqueueJob } from "../queues/jobs";

const PBKDF2_ITERATIONS = 310000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_ALGORITHM = "PBKDF2";
const PBKDF2_HASH = "SHA-256";

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("invalid hex");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derivePbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    PBKDF2_ALGORITHM,
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: PBKDF2_ALGORITHM,
      hash: PBKDF2_HASH,
      salt,
      iterations,
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );
  return bytesToHex(new Uint8Array(bits));
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashHex = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${hashHex}`;
}

async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  // Backward compatibility with old "salt:sha256" format
  if (stored.includes(":")) {
    const [salt, hash] = stored.split(":");
    const data = new TextEncoder().encode(salt + password);
    const computed = await crypto.subtle.digest("SHA-256", data);
    const computedHex = bytesToHex(new Uint8Array(computed));
    return constantTimeEquals(hash, computedHex);
  }

  const [scheme, iterationRaw, saltHex, hashHex] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterationRaw || !saltHex || !hashHex) {
    return false;
  }

  const iterations = Number.parseInt(iterationRaw, 10);
  if (!Number.isFinite(iterations) || iterations < 100000) return false;

  const salt = hexToBytes(saltHex);
  const computedHex = await derivePbkdf2(password, salt, iterations);
  return constantTimeEquals(hashHex, computedHex);
}

function setSessionCookie(c: any, env: Env, sessionId: string) {
  const { sameSite, secure } = resolveCookieOptions(env);
  setCookie(c, resolveSessionCookieName(env), sessionId, {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

async function issueSession(
  c: any,
  env: Env,
  db: ReturnType<typeof drizzle>,
  userId: number,
  currentOrgId: number
) {
  const session = await rotateSession(
    {
      deleteSessionsForUser: async (targetUserId) => {
        await db.delete(sessions).where(eq(sessions.userId, targetUserId));
      },
      createSession: async (record) => {
        await db.insert(sessions).values(record);
      },
    },
    userId,
    currentOrgId
  );
  setSessionCookie(c, env, session.id);
}

const app = new Hono<AppContextEnv>()
  .post(
    "/signup",
    rateLimit({ namespace: "auth-signup", maxRequests: 5, windowSeconds: 60 }),
    validator("json", signupSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const { email, password, name } = c.req.valid("json");

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing) {
        logRequestEvent("warn", "auth.signup_conflict", c, {});
        return jsonError(c, 409, "email_taken", "Email already registered");
      }

      const passwordHash = await hashPassword(password);
      const [user] = await db
        .insert(users)
        .values({ email, passwordHash, name })
        .returning();

      const roles = await ensureDefaultUserRole(db, user.id);
      const organization = await ensurePersonalOrganization(db, user.id, user.name);
      await issueSession(c, c.env, db, user.id, organization.organizationId);
      logRequestEvent("info", "auth.signup_success", c, { userId: user.id });
      await writeAuditLog(c.env.DB, c, {
        actorUserId: user.id,
        organizationId: organization.organizationId,
        action: "auth.signup",
        resourceType: "user",
        resourceId: String(user.id),
        status: 201,
        metadata: { roles, organizationId: organization.organizationId },
      });
      await enqueueJob(c.env.JOBS, {
        type: "user.welcome",
        payload: {
          userId: user.id,
          email: user.email,
          name: user.name,
          requestId: c.get("requestId"),
        },
      });
      return c.json({
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
        currentOrganizationId: organization.organizationId,
        organizations: [organization],
      }, 201);
    }
  )
  .post(
    "/login",
    rateLimit({ namespace: "auth-login", maxRequests: 10, windowSeconds: 60 }),
    validator("json", loginSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const { email, password } = c.req.valid("json");

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        logRequestEvent("warn", "auth.login_failed", c, {
          reason: "invalid_credentials",
        });
        await writeAuditLog(c.env.DB, c, {
          action: "auth.login_failed",
          resourceType: "session",
          status: 401,
          metadata: { email },
        });
        return jsonError(c, 401, "invalid_credentials", "Invalid email or password");
      }

      if (user.passwordHash.includes(":")) {
        const upgradedHash = await hashPassword(password);
        await db
          .update(users)
          .set({ passwordHash: upgradedHash })
          .where(eq(users.id, user.id));
      }

      const roles = await ensureDefaultUserRole(db, user.id);
      const organization = await ensurePersonalOrganization(db, user.id, user.name);
      const organizations = await getMembershipSummaries(db, user.id);
      await issueSession(c, c.env, db, user.id, organization.organizationId);
      logRequestEvent("info", "auth.login_success", c, { userId: user.id });
      await writeAuditLog(c.env.DB, c, {
        actorUserId: user.id,
        organizationId: organization.organizationId,
        action: "auth.login",
        resourceType: "session",
        status: 200,
        metadata: { roles, organizationId: organization.organizationId },
      });
      return c.json({
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
        currentOrganizationId: organization.organizationId,
        organizations,
      });
    }
  )
  .post("/logout", requireAuth, async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");
    if (!userId) {
      return jsonError(c, 401, "unauthorized", "Authentication required");
    }
    const { sameSite, secure } = resolveCookieOptions(c.env);

    await db.delete(sessions).where(eq(sessions.userId, userId));
    deleteCookie(c, HOST_SESSION_COOKIE_NAME, {
      path: "/",
      sameSite,
      secure: true,
    });
    deleteCookie(c, LEGACY_SESSION_COOKIE_NAME, { path: "/", sameSite, secure });
    await writeAuditLog(c.env.DB, c, {
      actorUserId: userId,
      organizationId: c.get("orgId") ?? null,
      action: "auth.logout",
      resourceType: "session",
      status: 200,
    });
    return c.json({ ok: true });
  })
  .post(
    "/switch-org",
    requireAuth,
    validator("json", switchOrganizationSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const sessionId = c.get("sessionId");
      const userId = c.get("userId");
      const memberships = c.get("memberships") ?? [];
      const { organizationId } = c.req.valid("json");

      if (!sessionId || !userId) {
        return jsonError(c, 401, "unauthorized", "Authentication required");
      }

      const membership = memberships.find(
        (item) => item.organizationId === organizationId
      );

      if (!membership) {
        await writeAuditLog(c.env.DB, c, {
          actorUserId: userId,
          action: "auth.switch_org_denied",
          resourceType: "organization",
          resourceId: String(organizationId),
          status: 403,
        });
        return jsonError(c, 403, "organization_access_denied", "Forbidden");
      }

      await setSessionOrganization(db, sessionId, organizationId);
      await writeAuditLog(c.env.DB, c, {
        actorUserId: userId,
        organizationId,
        action: "auth.switch_org",
        resourceType: "organization",
        resourceId: String(organizationId),
        status: 200,
      });

      c.set("orgId", membership.organizationId);
      c.set("orgRole", membership.membershipRole);
      return c.json({
        ok: true,
        currentOrganizationId: membership.organizationId,
        organizationRole: membership.membershipRole,
      });
    }
  )
  .get("/me", requireAuth, async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");
    if (!userId) {
      return jsonError(c, 401, "unauthorized", "Authentication required");
    }
    const roles = c.get("roles") ?? [];
    const memberships = c.get("memberships") ?? [];
    const currentOrganizationId = c.get("orgId") ?? null;
    const organizationRole = c.get("orgRole") ?? null;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return jsonError(c, 404, "not_found", "User not found");
    }

    return c.json({
      ...user,
      roles,
      currentOrganizationId,
      organizationRole,
      organizations: memberships,
    });
  });

export default app;
