import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users, sessions } from "../db/schema";
import {
  emailVerificationConfirmSchema,
  emailVerificationRequestSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  signupSchema,
} from "../../shared/schemas/auth";
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
import { resolveAppBaseUrl } from "../lib/config";
import { jsonError } from "../lib/http";
import { logRequestEvent } from "../lib/logging";
import {
  ensurePersonalOrganization,
  getMembershipSummaries,
  setSessionOrganization,
} from "../lib/organizations";
import {
  consumeEmailVerificationToken,
  createEmailVerificationToken,
} from "../lib/email-verification";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
} from "../lib/password-reset";
import {
  hashPassword,
  needsPasswordUpgrade,
  verifyPassword,
} from "../lib/password";
import { ensureDefaultUserRole } from "../lib/rbac";
import { validator } from "../lib/validator";
import { enqueueJob } from "../queues/jobs";

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
      const verification = await createEmailVerificationToken(db, user.id);
      await enqueueJob(c.env.JOBS, {
        type: "auth.email_verification_email",
        payload: {
          userId: user.id,
          email: user.email,
          verifyUrl: `${resolveAppBaseUrl(c.env, c.req.url)}/?verifyToken=${verification.token}`,
          requestId: c.get("requestId"),
        },
      });
      return c.json({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerifiedAt: user.emailVerifiedAt,
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

      if (needsPasswordUpgrade(user.passwordHash)) {
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
        emailVerifiedAt: user.emailVerifiedAt,
        roles,
        currentOrganizationId: organization.organizationId,
        organizations,
      });
    }
  )
  .post(
    "/email-verification/request",
    requireAuth,
    validator("json", emailVerificationRequestSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const userId = c.get("userId");

      if (!userId) {
        return jsonError(c, 401, "unauthorized", "Authentication required");
      }

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          emailVerifiedAt: users.emailVerifiedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return jsonError(c, 404, "not_found", "User not found");
      }

      if (!user.emailVerifiedAt) {
        const verification = await createEmailVerificationToken(db, user.id);
        await enqueueJob(c.env.JOBS, {
          type: "auth.email_verification_email",
          payload: {
            userId: user.id,
            email: user.email,
            verifyUrl: `${resolveAppBaseUrl(c.env, c.req.url)}/?verifyToken=${verification.token}`,
            requestId: c.get("requestId"),
          },
        });
      }

      await writeAuditLog(c.env.DB, c, {
        actorUserId: user.id,
        organizationId: c.get("orgId") ?? null,
        action: "auth.email_verification_request",
        resourceType: "email_verification",
        status: 200,
        metadata: { alreadyVerified: !!user.emailVerifiedAt },
      });

      return c.json({ ok: true, emailVerifiedAt: user.emailVerifiedAt ?? null });
    }
  )
  .post(
    "/email-verification/confirm",
    validator("json", emailVerificationConfirmSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const { token } = c.req.valid("json");
      const result = await consumeEmailVerificationToken(db, token);

      if (!result.ok) {
        const codeByReason = {
          not_found: ["email_verification_not_found", 404],
          expired: ["email_verification_expired", 410],
          verified: ["email_verification_verified", 409],
        } as const;
        const [code, status] = codeByReason[result.reason];
        await writeAuditLog(c.env.DB, c, {
          action: "auth.email_verification_confirm_denied",
          resourceType: "email_verification",
          status,
          metadata: { reason: result.reason },
        });
        return jsonError(c, status, code, "Forbidden");
      }

      await writeAuditLog(c.env.DB, c, {
        actorUserId: result.userId,
        action: "auth.email_verification_confirm",
        resourceType: "email_verification",
        resourceId: String(result.tokenId),
        status: 200,
      });

      return c.json({
        ok: true,
        emailVerifiedAt: result.emailVerifiedAt,
      });
    }
  )
  .post(
    "/password-reset/request",
    rateLimit({
      namespace: "auth-password-reset-request",
      maxRequests: 5,
      windowSeconds: 60,
    }),
    validator("json", passwordResetRequestSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const { email } = c.req.valid("json");

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (user) {
        const reset = await createPasswordResetToken(db, user.id);
        await enqueueJob(c.env.JOBS, {
          type: "auth.password_reset_email",
          payload: {
            userId: user.id,
            email: user.email,
            resetUrl: `${resolveAppBaseUrl(c.env, c.req.url)}/?resetToken=${reset.token}`,
            requestId: c.get("requestId"),
          },
        });
        await writeAuditLog(c.env.DB, c, {
          actorUserId: user.id,
          action: "auth.password_reset_request",
          resourceType: "password_reset",
          resourceId: String(reset.id),
          status: 200,
        });
      } else {
        await writeAuditLog(c.env.DB, c, {
          action: "auth.password_reset_request",
          resourceType: "password_reset",
          status: 200,
          metadata: { email },
        });
      }

      return c.json({ ok: true });
    }
  )
  .post(
    "/password-reset/confirm",
    rateLimit({
      namespace: "auth-password-reset-confirm",
      maxRequests: 10,
      windowSeconds: 60,
    }),
    validator("json", passwordResetConfirmSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const { token, password } = c.req.valid("json");
      const result = await consumePasswordResetToken(db, token);

      if (!result.ok) {
        const codeByReason = {
          not_found: ["password_reset_not_found", 404],
          expired: ["password_reset_expired", 410],
          used: ["password_reset_used", 409],
        } as const;
        const [code, status] = codeByReason[result.reason];
        await writeAuditLog(c.env.DB, c, {
          action: "auth.password_reset_confirm_denied",
          resourceType: "password_reset",
          status,
          metadata: { reason: result.reason },
        });
        return jsonError(c, status, code, "Forbidden");
      }

      const passwordHash = await hashPassword(password);
      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, result.userId));
      await db.delete(sessions).where(eq(sessions.userId, result.userId));

      await writeAuditLog(c.env.DB, c, {
        actorUserId: result.userId,
        action: "auth.password_reset_confirm",
        resourceType: "password_reset",
        resourceId: String(result.tokenId),
        status: 200,
      });

      return c.json({ ok: true });
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
        emailVerifiedAt: users.emailVerifiedAt,
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
