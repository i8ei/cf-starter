import { Hono } from "hono";
import { requireAuth } from "../../../../src/middleware/auth";
import { requireOrgRole } from "../../../../src/middleware/require-org-role";
import type { AppContextEnv } from "../../../../src/types";
import { writeAuditLog } from "../../../../src/lib/audit";
import { jsonError } from "../../../../src/lib/http";
import { enqueueJob } from "../../../../src/queues/jobs";
import {
  getExampleUploadObjectKey,
  getExampleUploadPrefix,
} from "../../../lib/organization-scope";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const sanitizeFilename = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);

const app = new Hono<AppContextEnv>()
  .use("*", requireAuth)
  .use("*", requireOrgRole())
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
    const list = await c.env.BUCKET.list({ prefix: getExampleUploadPrefix(orgId) });
    const files = list.objects.map((o) => ({
      key: o.key,
      size: o.size,
      uploaded: o.uploaded,
      organizationId: orgId,
    }));
    return c.json(files);
  })
  .post("/", async (c) => {
    const orgId = c.get("orgId");
    if (!orgId) {
      return jsonError(
        c,
        403,
        "org_context_required",
        "Current organization is required"
      );
    }
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return jsonError(c, 400, "file_required", "File is required");
    }
    if (file.size > MAX_FILE_SIZE) {
      return jsonError(c, 400, "file_too_large", "File too large", {
        maxBytes: MAX_FILE_SIZE,
      });
    }

    const safeName = sanitizeFilename(file.name);
    const key = getExampleUploadObjectKey(orgId, safeName);
    await c.env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    await writeAuditLog(c.env.DB, c, {
      actorUserId: c.get("userId") ?? null,
      organizationId: orgId,
      action: "upload.create",
      resourceType: "r2",
      resourceId: key,
      status: 201,
      metadata: { size: file.size, contentType: file.type || null },
    });
    await enqueueJob(c.env.JOBS, {
      type: "upload.process",
      payload: {
        key,
        organizationId: orgId,
        size: file.size,
        contentType: file.type || null,
        requestId: c.get("requestId"),
      },
    });
    return c.json({ key, size: file.size, organizationId: orgId }, 201);
  });

export default app;

