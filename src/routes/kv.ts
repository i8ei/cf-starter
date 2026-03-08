import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/require-role";
import type { AppContextEnv } from "../types";
import { writeAuditLog } from "../lib/audit";
import { jsonError } from "../lib/http";
import { ADMIN_ROLE } from "../lib/rbac";
import { validator } from "../lib/validator";

const keySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-zA-Z0-9._:-]+$/, "invalid key characters"),
});

const app = new Hono<AppContextEnv>()
  .use("*", requireAuth)
  .use("*", requireRole(ADMIN_ROLE))
  .get("/:key", validator("param", keySchema), async (c) => {
    const { key } = c.req.valid("param");
    const value = await c.env.KV.get(key);
    if (value === null) {
      return jsonError(c, 404, "not_found", "Resource not found");
    }
    return c.json({ key, value });
  })
  .put(
    "/:key",
    validator("param", keySchema),
    validator("json", z.object({ value: z.string() })),
    async (c) => {
      const { key } = c.req.valid("param");
      const { value } = c.req.valid("json");
      await c.env.KV.put(key, value);
      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
        action: "kv.put",
        resourceType: "kv",
        resourceId: key,
        status: 200,
      });
      return c.json({ key, value });
    }
  );

export default app;
