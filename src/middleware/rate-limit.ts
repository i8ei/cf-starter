import { createMiddleware } from "hono/factory";
import type { Env } from "../types";
import { getClientIp, logRequestEvent } from "../lib/logging";

type RateLimitOptions = {
  namespace: string;
  maxRequests: number;
  windowSeconds: number;
};

export function rateLimit(options: RateLimitOptions) {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const ip = getClientIp(c.req.raw.headers);
    const windowMs = options.windowSeconds * 1000;
    const bucket = Math.floor(Date.now() / windowMs);
    const windowEnd = (bucket + 1) * windowMs;
    const key = `rl:${options.namespace}:${ip}:${bucket}`;

    const id = c.env.RATE_LIMITER.idFromName(key);
    const stub = c.env.RATE_LIMITER.get(id);
    const res = await stub.fetch("https://rate-limiter/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        maxRequests: options.maxRequests,
        windowEnd,
      }),
    });

    if (!res.ok) {
      throw new Error(`rate limiter request failed (${res.status})`);
    }

    const result = (await res.json()) as {
      allowed: boolean;
      count: number;
      remaining: number;
      retryAfterSeconds: number;
    };

    c.header("X-RateLimit-Limit", String(options.maxRequests));
    c.header("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfterSeconds));
      logRequestEvent("warn", "rate_limit.hit", c, {
        namespace: options.namespace,
        limit: options.maxRequests,
        count: result.count,
      });
      return c.json({ error: "too many requests" }, 429);
    }

    await next();
  });
}
