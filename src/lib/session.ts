import { getCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Env } from "../types";

export const HOST_SESSION_COOKIE_NAME = "__Host-session";
export const LEGACY_SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const COOKIE_SAME_SITE_VALUES = new Set(["Lax", "Strict", "None"]);

export type SessionCookieSameSite = "Lax" | "Strict" | "None";

export type SessionRecord = {
  id: string;
  userId: number;
  expiresAt: string;
};

export type SessionRepository = {
  deleteSessionsForUser(userId: number): Promise<void>;
  createSession(session: SessionRecord): Promise<void>;
};

export function resolveCookieSameSite(raw?: string): SessionCookieSameSite {
  if (!raw) return "Lax";
  const normalized = raw[0].toUpperCase() + raw.slice(1).toLowerCase();
  if (COOKIE_SAME_SITE_VALUES.has(normalized)) {
    return normalized as SessionCookieSameSite;
  }
  return "Lax";
}

export function resolveCookieSecure(
  raw: string | undefined,
  sameSite: SessionCookieSameSite
): boolean {
  if (sameSite === "None") return true;
  if (raw === undefined) return true;
  return raw.toLowerCase() !== "false";
}

export function resolveCookieOptions(env: Env) {
  const sameSite = resolveCookieSameSite(env.COOKIE_SAME_SITE);
  const secure = resolveCookieSecure(env.COOKIE_SECURE, sameSite);
  return { sameSite, secure };
}

export function resolveSessionCookieName(env: Env): string {
  return resolveCookieOptions(env).secure
    ? HOST_SESSION_COOKIE_NAME
    : LEGACY_SESSION_COOKIE_NAME;
}

export function getSessionCookie(c: Context): string | undefined {
  return (
    getCookie(c, HOST_SESSION_COOKIE_NAME) ??
    getCookie(c, LEGACY_SESSION_COOKIE_NAME)
  );
}

export function hasSessionCookie(cookieHeader: string): boolean {
  return (
    cookieHeader.includes(`${HOST_SESSION_COOKIE_NAME}=`) ||
    cookieHeader.includes(`${LEGACY_SESSION_COOKIE_NAME}=`)
  );
}

export async function rotateSession(
  repository: SessionRepository,
  userId: number,
  now = Date.now()
): Promise<SessionRecord> {
  await repository.deleteSessionsForUser(userId);

  const session = {
    id: crypto.randomUUID(),
    userId,
    expiresAt: new Date(now + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
  };

  await repository.createSession(session);
  return session;
}
