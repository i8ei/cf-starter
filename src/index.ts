import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env } from "./types";
import health from "./routes/health";
import items from "./routes/items";
import kv from "./routes/kv";
import upload from "./routes/upload";
import auth from "./routes/auth";

const app = new Hono<{ Bindings: Env }>()
  .use("*", logger())
  .use(
    "/api/*",
    cors({
      origin: ["http://localhost:5173"], // 本番では自ドメインに変更
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    })
  )
  .onError((err, c) => {
    console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);
    return c.json({ error: "Internal Server Error" }, 500);
  })
  .route("/api/health", health)
  .route("/api/items", items)
  .route("/api/kv", kv)
  .route("/api/upload", upload)
  .route("/api/auth", auth);

export type AppType = typeof app;
export default app;
