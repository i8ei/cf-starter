import { createMiddleware } from "hono/factory";
import type { Env } from "../types";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_ORIGINS = ["http://localhost:5173"];

function resolveAllowedOrigins(raw?: string): string[] {
  if (!raw) return DEFAULT_ORIGINS;
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : DEFAULT_ORIGINS;
}

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
  if (!cookieHeader.includes("session=")) {
    await next();
    return;
  }

  const allowlist = resolveAllowedOrigins(c.env.CORS_ORIGIN);
  const origin = c.req.header("origin");
  if (origin && allowlist.includes(origin)) {
    await next();
    return;
  }

  if (isAllowedReferer(c.req.header("referer"), allowlist)) {
    await next();
    return;
  }

  return c.json({ error: "forbidden (csrf)" }, 403);
});
