import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>().get("/", async (c) => {
  const checks: Record<string, string> = {};

  // Bindings check
  checks.env = c.env.DB && c.env.KV && c.env.BUCKET && c.env.RATE_LIMITER ? "ok" : "missing";

  try {
    await c.env.DB.prepare("SELECT 1").first();
    checks.d1 = "ok";
  } catch {
    checks.d1 = "error";
  }

  try {
    await c.env.KV.get("_health");
    checks.kv = "ok";
  } catch {
    checks.kv = "error";
  }

  try {
    await c.env.BUCKET.head("_health");
    checks.r2 = "ok";
  } catch {
    checks.r2 = "error";
  }

  try {
    const id = c.env.RATE_LIMITER.idFromName("_health");
    const stub = c.env.RATE_LIMITER.get(id);
    const res = await stub.fetch("https://rate-limiter/ping");
    checks.rateLimiter = res.ok ? "ok" : "error";
  } catch {
    checks.rateLimiter = "error";
  }

  const status = Object.values(checks).every((v) => v === "ok") ? "ok" : "degraded";
  return c.json({ status, checks });
});

export default app;
