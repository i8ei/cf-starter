import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { AppContextEnv } from "../../types";
import { resolveAuthMode } from "../../lib/auth-mode";
import { createAdminSessionToken, constantTimeEquals } from "../../lib/simple-admin-session";
import {
  resolveCookieOptions,
  resolveSessionCookieName,
  SESSION_MAX_AGE_SECONDS,
} from "../../lib/session";
import { jsonError } from "../../lib/http";
import { validator } from "../../lib/validator";
import { adminLoginSchema } from "../../../shared/schemas/auth";
import { rateLimit } from "../../middleware/rate-limit";

const app = new Hono<AppContextEnv>().post(
  "/admin-login",
  rateLimit({ namespace: "auth-admin-login", maxRequests: 10, windowSeconds: 60 }),
  validator("json", adminLoginSchema),
  async (c) => {
    if (resolveAuthMode(c.env) !== "simple-admin") {
      return jsonError(c, 404, "not_found", "Not found");
    }
    if (!c.env.ADMIN_PASSWORD) {
      return jsonError(c, 500, "config_error", "ADMIN_PASSWORD not configured");
    }

    const { password } = c.req.valid("json");
    if (!constantTimeEquals(password, c.env.ADMIN_PASSWORD)) {
      return jsonError(c, 401, "invalid_credentials", "Invalid password");
    }

    const token = await createAdminSessionToken(c.env.ADMIN_PASSWORD);
    const { sameSite, secure } = resolveCookieOptions(c.env);
    setCookie(c, resolveSessionCookieName(c.env), token, {
      httpOnly: true,
      secure,
      sameSite,
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return c.json({
      id: "1",
      name: "Admin",
      roles: ["admin"],
    });
  }
);

export default app;
