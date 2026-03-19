import { getCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Env } from "../types";
import { getAppConfig } from "./config";

export const HOST_SESSION_COOKIE_NAME = "__Host-session";
export const LEGACY_SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function resolveCookieOptions(env: Env) {
  const config = getAppConfig(env);
  return {
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
  };
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
