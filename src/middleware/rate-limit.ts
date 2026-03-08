import { createMiddleware } from "hono/factory";
import type { Env } from "../types";

type RateLimitOptions = {
  namespace: string;
  maxRequests: number;
  windowSeconds: number;
};

function getClientIp(headers: Headers): string {
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

export function rateLimit(options: RateLimitOptions) {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const ip = getClientIp(c.req.raw.headers);
    const bucket = Math.floor(Date.now() / (options.windowSeconds * 1000));
    const key = `rl:${options.namespace}:${ip}:${bucket}`;
    const currentRaw = await c.env.KV.get(key);
    const current = currentRaw ? Number.parseInt(currentRaw, 10) : 0;

    if (current >= options.maxRequests) {
      c.header("Retry-After", String(options.windowSeconds));
      return c.json({ error: "too many requests" }, 429);
    }

    const nextCount = Number.isFinite(current) ? current + 1 : 1;
    await c.env.KV.put(key, String(nextCount), { expirationTtl: options.windowSeconds });
    await next();
  });
}
