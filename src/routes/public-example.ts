/**
 * Public API route example — no authentication required.
 *
 * Mount in src/index.ts:
 *   import publicExample from "./routes/public-example";
 *   .route("/api/public/example", publicExample)
 *
 * CSRF protection skips GET requests, so GET-only public routes
 * work without any middleware changes.
 *
 * Delete this file when you don't need the example.
 */
import { Hono } from "hono";
import type { AppContextEnv } from "../types";

const publicExample = new Hono<AppContextEnv>()

  .get("/hello", (c) => {
    return c.json({ message: "Hello from public API" });
  });

export default publicExample;
