import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import health from "./routes/health";
import items from "./routes/items";
import kv from "./routes/kv";
import upload from "./routes/upload";

const app = new Hono<{ Bindings: Env }>()
  .use("/api/*", cors())
  .route("/api/health", health)
  .route("/api/items", items)
  .route("/api/kv", kv)
  .route("/api/upload", upload);

export type AppType = typeof app;
export default app;
