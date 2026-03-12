import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { AppContextEnv, Env } from "./types";
import health from "./routes/health";
import auth from "./routes/auth";
import orgs from "./routes/orgs";
import modules from "./routes/modules";
import {
  purgeExpiredSessions,
  purgeStaleAuthTokens,
} from "./db/session-maintenance";
import { csrfProtection } from "./middleware/csrf";
import { resolveCorsOrigins } from "./lib/cors";
import { logEvent } from "./lib/logging";
import { RateLimiter } from "./durable-objects/rate-limiter";
import { requestId } from "./middleware/request-id";
import { jsonError } from "./lib/http";
import { handleJobBatch } from "./queues/jobs";
// scaffold:feature-import:start items
// scaffold:feature-import:end items
// scaffold:feature-import:start kv
// scaffold:feature-import:end kv
// scaffold:feature-import:start upload
// scaffold:feature-import:end upload

export const app = new Hono<AppContextEnv>()
  .use("*", requestId)
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
        const allowlist = resolveCorsOrigins(c.env);
        if (!origin) return allowlist[0];
        return allowlist.includes(origin) ? origin : "";
      },
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use("/api/*", csrfProtection)
  .onError((err, c) => {
    logEvent("error", "request.error", {
      method: c.req.method,
      path: c.req.path,
      message: err.message,
      requestId: c.get("requestId"),
    });
    return jsonError(c, 500, "internal_error", "Internal Server Error");
  })
  .route("/api/health", health)
  .route("/api/modules", modules)
  .route("/api/orgs", orgs)
  // scaffold:feature-route:start items
  // scaffold:feature-route:end items
  // scaffold:feature-route:start kv
  // scaffold:feature-route:end kv
  // scaffold:feature-route:start upload
  // scaffold:feature-route:end upload
  .route("/api/auth", auth);

export type AppType = typeof app;
export { RateLimiter };
export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env) => {
    const deletedSessions = await purgeExpiredSessions(env.DB);
    if (deletedSessions > 0) {
      logEvent("info", "sessions.purged", { deleted: deletedSessions });
    }

    const deletedAuthTokens = await purgeStaleAuthTokens(env.DB);
    if (deletedAuthTokens > 0) {
      logEvent("info", "auth_tokens.purged", { deleted: deletedAuthTokens });
    }
  },
  queue: handleJobBatch,
};
