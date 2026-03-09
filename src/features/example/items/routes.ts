import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { items } from "../../../db/schema";
import {
  createItemSchema,
  updateItemSchema,
} from "../../../../shared/features/example/items/schema";
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
  )
  .put(
    "/:id",
    validator("json", updateItemSchema),
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
      const id = Number(c.req.param("id"));
      const { name } = c.req.valid("json");
      const [row] = await db
        .update(items)
        .set({ name })
        .where(and(eq(items.id, id), eq(items.organizationId, orgId)))
        .returning();
      if (!row) {
        return jsonError(c, 404, "not_found", "Item not found");
      }
      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
        organizationId: orgId,
        action: "item.update",
        resourceType: "item",
        resourceId: String(row.id),
        status: 200,
        metadata: { name: row.name },
      });
      return c.json(row);
    }
  )
  .delete("/:id", async (c) => {
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
    const id = Number(c.req.param("id"));
    const [row] = await db
      .delete(items)
      .where(and(eq(items.id, id), eq(items.organizationId, orgId)))
      .returning();
    if (!row) {
      return jsonError(c, 404, "not_found", "Item not found");
    }
    await writeAuditLog(c.env.DB, c, {
      actorUserId: c.get("userId") ?? null,
      organizationId: orgId,
      action: "item.delete",
      resourceType: "item",
      resourceId: String(row.id),
      status: 200,
      metadata: { name: row.name },
    });
    return c.json({ ok: true });
  });

export default app;
