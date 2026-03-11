import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../../../../src/middleware/auth";
import { requireOrgRole } from "../../../../src/middleware/require-org-role";
import type { AppContextEnv } from "../../../../src/types";
import { writeAuditLog } from "../../../../src/lib/audit";
import { jsonError } from "../../../../src/lib/http";
import { validator } from "../../../../src/lib/validator";
import { getExampleKvScopedKey } from "../../../lib/organization-scope";

const keySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-zA-Z0-9._:-]+$/, "invalid key characters"),
});

const app = new Hono<AppContextEnv>()
  .use("*", requireAuth)
  .use("*", requireOrgRole())
  .get("/:key", validator("param", keySchema), async (c) => {
    const orgId = c.get("orgId");
    if (!orgId) {
      return jsonError(
        c,
        403,
        "org_context_required",
        "Current organization is required"
      );
    }
    const { key } = c.req.valid("param");
    const scopedKey = getExampleKvScopedKey(orgId, key);
    const value = await c.env.KV.get(scopedKey);
    if (value === null) {
      return jsonError(c, 404, "not_found", "Resource not found");
    }
    return c.json({ key, value, organizationId: orgId });
  })
  .put(
    "/:key",
    validator("param", keySchema),
    validator("json", z.object({ value: z.string() })),
    async (c) => {
      const orgId = c.get("orgId");
      if (!orgId) {
        return jsonError(
          c,
          403,
          "org_context_required",
          "Current organization is required"
        );
      }
      const { key } = c.req.valid("param");
      const { value } = c.req.valid("json");
      const scopedKey = getExampleKvScopedKey(orgId, key);
      await c.env.KV.put(scopedKey, value);
      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
        organizationId: orgId,
        action: "kv.put",
        resourceType: "kv",
        resourceId: scopedKey,
        status: 200,
      });
      return c.json({ key, value, organizationId: orgId });
    }
  );

export default app;

