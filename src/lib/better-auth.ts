import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { Env } from "../types";
import { resolveAppBaseUrl } from "./config";
import { resolveCorsOrigins } from "./cors";
import { sendOrganizationInvite } from "../queues/jobs";

/**
 * Per-request auth instance factory.
 * MUST create a new instance per request — D1 binding is request-scoped.
 * Singleton will cause 30s+ hangs due to stale D1 references.
 */
export function createAuth(env: Env) {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: resolveAppBaseUrl(env),
    basePath: "/api/auth",
    plugins: [
      admin(),
      organization({
        creatorRole: "owner",
        membershipLimit: 100,
        sendInvitationEmail: async (data, request) => {
          const inviteUrl = new URL("/invite", resolveAppBaseUrl(env));
          inviteUrl.searchParams.set("id", data.id);

          await sendOrganizationInvite(env, {
            organizationId: data.organization.id,
            organizationName: data.organization.name,
            inviteId: data.id,
            email: data.email,
            role: data.role,
            inviteUrl: inviteUrl.toString(),
            requestId: request?.headers.get("x-request-id") ?? crypto.randomUUID(),
          });
        },
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24,      // refresh after 1 day
      // cookieCache disabled — known bug with KV on Workers (#4203)
    },
    advanced: {
      cookiePrefix: "ba",
      defaultCookieAttributes: {
        httpOnly: true,
        secure: env.COOKIE_SECURE !== "false",
        sameSite: "lax",
        path: "/",
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: [
      ...resolveCorsOrigins(env),
      // Dev convenience: allow localhost with any port. Safe in production because
      // Better Auth trustedOrigins only gate CSRF origin matching, not cookie validation.
      "http://localhost:*",
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
