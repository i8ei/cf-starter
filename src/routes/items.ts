import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { items } from "../db/schema";
import { desc } from "drizzle-orm";
import { createItemSchema } from "../../shared/schemas/items";
import type { AppContextEnv } from "../types";
import { writeAuditLog } from "../lib/audit";

const app = new Hono<AppContextEnv>()
  .get("/", async (c) => {
    const db = drizzle(c.env.DB);
    const rows = await db.select().from(items).orderBy(desc(items.createdAt));
    return c.json(rows);
  })
  .post(
    "/",
    zValidator("json", createItemSchema),
    async (c) => {
      const db = drizzle(c.env.DB);
      const { name } = c.req.valid("json");
      const [row] = await db.insert(items).values({ name }).returning();
      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
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
