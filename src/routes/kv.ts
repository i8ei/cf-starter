import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import type { Env } from "../types";

const keySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-zA-Z0-9._:-]+$/, "invalid key characters"),
});

const app = new Hono<{ Bindings: Env; Variables: { userId: number } }>()
  .use("*", requireAuth)
  .get("/:key", zValidator("param", keySchema), async (c) => {
    const { key } = c.req.valid("param");
    const value = await c.env.KV.get(key);
    if (value === null) return c.json({ error: "not found" }, 404);
    return c.json({ key, value });
  })
  .put(
    "/:key",
    zValidator("param", keySchema),
    zValidator("json", z.object({ value: z.string() })),
    async (c) => {
      const { key } = c.req.valid("param");
      const { value } = c.req.valid("json");
      await c.env.KV.put(key, value);
      return c.json({ key, value });
    }
  );

export default app;
