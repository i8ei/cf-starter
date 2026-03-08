import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>()
  .get("/:key", async (c) => {
    const key = c.req.param("key");
    const value = await c.env.KV.get(key);
    if (value === null) return c.json({ error: "not found" }, 404);
    return c.json({ key, value });
  })
  .put(
    "/:key",
    zValidator("json", z.object({ value: z.string() })),
    async (c) => {
      const key = c.req.param("key");
      const { value } = c.req.valid("json");
      await c.env.KV.put(key, value);
      return c.json({ key, value });
    }
  );

export default app;
