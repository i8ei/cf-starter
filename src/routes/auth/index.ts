import { Hono } from "hono";
import type { AppContextEnv } from "../../types";
import { resolveAuthMode } from "../../lib/auth-mode";
import { createAuth } from "../../lib/better-auth";
import { jsonError } from "../../lib/http";
import { rateLimit } from "../../middleware/rate-limit";
import simpleAdmin from "./simple-admin";
import session from "./session";

const app = new Hono<AppContextEnv>()
  // simple-admin routes (POST /admin-login) — self-guarded
  .route("/", simpleAdmin)
  // Custom session routes (GET /me, POST /logout, POST /switch-org) — all modes
  .route("/", session)
  // Better Auth catch-all — handles sign-up, sign-in, sign-out, etc.
  // Rate limit mutating requests (sign-up, sign-in, password reset, etc.)
  .all("/*", rateLimit({ namespace: "auth-better-auth", maxRequests: 10, windowSeconds: 60 }), async (c) => {
    if (resolveAuthMode(c.env) !== "better-auth") {
      return jsonError(c, 404, "not_found", "Not found");
    }
    const auth = createAuth(c.env);
    return auth.handler(c.req.raw);
  });

export default app;
