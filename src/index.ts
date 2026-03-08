import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env } from "./types";
import health from "./routes/health";
import items from "./routes/items";
import kv from "./routes/kv";
import upload from "./routes/upload";

const app = new Hono<{ Bindings: Env }>()
  .use("*", logger())
  .use(
    "/api/*",
    cors({
      origin: (origin) => origin, // 開発時は全許可。本番では固定ドメインに変更
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
  .route("/api/upload", upload);

export type AppType = typeof app;
export default app;
