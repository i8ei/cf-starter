import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { items } from "../../../db/schema";
import { createItemSchema } from "../../../../shared/features/example/items/schema";
import { requireAuth } from "../../../middleware/auth";
import type { AppContextEnv } from "../../../types";
import { writeAuditLog } from "../../../lib/audit";
import { jsonError } from "../../../lib/http";
import { validator } from "../../../lib/validator";

const app = new Hono<AppContextEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    const orgId = c.get("orgId");
    if (!orgId) {
      return jsonError(
        c,
        403,
        "org_context_required",
        "Current organization is required"
      );
    }
    const db = drizzle(c.env.DB);
    const rows = await db
      .select()
      .from(items)
      .where(eq(items.organizationId, orgId))
      .orderBy(desc(items.createdAt));
    return c.json(rows);
  })
  .post(
    "/",
    validator("json", createItemSchema),
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
      const db = drizzle(c.env.DB);
      const { name } = c.req.valid("json");
      const [row] = await db
        .insert(items)
        .values({ organizationId: orgId, name })
        .returning();
      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
        organizationId: orgId,
        action: "item.create",
        resourceType: "item",
        resourceId: String(row.id),
        status: 201,
        metadata: { name: row.name },
      });
      return c.json(row, 201);
    }
  );

export default app;
