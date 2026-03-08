import { Hono } from "hono";
import type { Env } from "../types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const sanitizeFilename = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);

const app = new Hono<{ Bindings: Env }>()
  .get("/", async (c) => {
    const list = await c.env.BUCKET.list({ prefix: "uploads/" });
    const files = list.objects.map((o) => ({
      key: o.key,
      size: o.size,
      uploaded: o.uploaded,
    }));
    return c.json(files);
  })
  .post("/", async (c) => {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "file is required" }, 400);
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: `file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` }, 400);
    }

    const safeName = sanitizeFilename(file.name);
    const key = `uploads/${Date.now()}_${safeName}`;
    await c.env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    return c.json({ key, size: file.size }, 201);
  });

export default app;
