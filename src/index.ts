import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./types";
import health from "./routes/health";
import items from "./routes/items";
import kv from "./routes/kv";
import upload from "./routes/upload";
import auth from "./routes/auth";
import { purgeExpiredSessions } from "./db/session-maintenance";
import { csrfProtection } from "./middleware/csrf";
import { resolveCorsOrigins } from "./lib/cors";
import { logEvent } from "./lib/logging";
import { RateLimiter } from "./durable-objects/rate-limiter";

export const app = new Hono<{ Bindings: Env }>()
  .use("*", logger())
  .use(
    "*",
    secureHeaders({
      xFrameOptions: "DENY",
      xContentTypeOptions: "nosniff",
      referrerPolicy: "strict-origin-when-cross-origin",
    })
  )
  .use(
    "/api/*",
    cors({
      origin: (origin, c) => {
        const allowlist = resolveCorsOrigins(c.env.CORS_ORIGIN);
        if (!origin) return allowlist[0];
        return allowlist.includes(origin) ? origin : allowlist[0];
      },
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use("/api/*", csrfProtection)
  .onError((err, c) => {
    logEvent("error", "request.error", {
      method: c.req.method,
      path: c.req.path,
      message: err.message,
    });
    return c.json({ error: "Internal Server Error" }, 500);
  })
  .route("/api/health", health)
  .route("/api/items", items)
  .route("/api/kv", kv)
  .route("/api/upload", upload)
  .route("/api/auth", auth);

export type AppType = typeof app;
export { RateLimiter };
export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env) => {
    const deleted = await purgeExpiredSessions(env.DB);
    if (deleted > 0) {
      logEvent("info", "sessions.purged", { deleted });
    }
  },
};
