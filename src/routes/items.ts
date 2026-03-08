import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { items } from "../db/schema";
import { desc } from "drizzle-orm";
import { createItemSchema } from "../../shared/schemas/items";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>()
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
      return c.json(row, 201);
    }
  );

export default app;
