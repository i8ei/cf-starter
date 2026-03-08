import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>().get("/", async (c) => {
  const checks: Record<string, string> = {};

  // Bindings check
  checks.env = c.env.DB && c.env.KV && c.env.BUCKET ? "ok" : "missing";

  try {
    await c.env.DB.prepare("SELECT 1").first();
    checks.d1 = "ok";
  } catch {
    checks.d1 = "error";
  }

  try {
    await c.env.KV.put("_health", "ok");
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

  const status = Object.values(checks).every((v) => v === "ok") ? "ok" : "degraded";
  return c.json({ status, checks });
});

export default app;
