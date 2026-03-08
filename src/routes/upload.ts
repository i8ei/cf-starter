import { Hono } from "hono";
import type { Env } from "../types";

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

    const key = `uploads/${Date.now()}_${file.name}`;
    await c.env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    return c.json({ key, size: file.size }, 201);
  });

export default app;
