import { createMiddleware } from "hono/factory";
import type { Env } from "../types";
import { resolveCorsOrigins } from "../lib/cors";
import { logRequestEvent } from "../lib/logging";
import { hasSessionCookie } from "../lib/session";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isAllowedReferer(referer: string | undefined, allowlist: string[]): boolean {
  if (!referer) return false;
  try {
    return allowlist.includes(new URL(referer).origin);
  } catch {
    return false;
  }
}

export const csrfProtection = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (!MUTATING_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  const cookieHeader = c.req.header("cookie") ?? "";
  if (!hasSessionCookie(cookieHeader)) {
    await next();
    return;
  }

  const allowlist = resolveCorsOrigins(c.env.CORS_ORIGIN);
  const origin = c.req.header("origin");
  if (origin && allowlist.includes(origin)) {
    await next();
    return;
  }

  if (isAllowedReferer(c.req.header("referer"), allowlist)) {
    await next();
    return;
  }

  logRequestEvent("warn", "security.csrf_rejected", c, {
    origin: origin ?? null,
    referer: c.req.header("referer") ?? null,
  });
  return c.json({ error: "forbidden (csrf)" }, 403);
});
