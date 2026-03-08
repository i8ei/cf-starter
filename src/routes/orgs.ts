import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { requireAuth } from "../middleware/auth";
import type { AppContextEnv } from "../types";
import { createOrganizationForUser, getMembershipSummaries, setSessionOrganization } from "../lib/organizations";
import { writeAuditLog } from "../lib/audit";
import { jsonError } from "../lib/http";
import { validator } from "../lib/validator";
import { createOrganizationSchema } from "../../shared/schemas/orgs";

const app = new Hono<AppContextEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => {
    return c.json({
      currentOrganizationId: c.get("orgId") ?? null,
      organizationRole: c.get("orgRole") ?? null,
      organizations: c.get("memberships") ?? [],
    });
  })
  .post("/", validator("json", createOrganizationSchema), async (c) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("userId");
    const sessionId = c.get("sessionId");

    if (!userId || !sessionId) {
      return jsonError(c, 401, "unauthorized", "Authentication required");
    }

    const { name } = c.req.valid("json");
    const organization = await createOrganizationForUser(db, userId, name);
    await setSessionOrganization(db, sessionId, organization.organizationId);
    const organizations = await getMembershipSummaries(db, userId);

    await writeAuditLog(c.env.DB, c, {
      actorUserId: userId,
      organizationId: organization.organizationId,
      action: "organization.create",
      resourceType: "organization",
      resourceId: String(organization.organizationId),
      status: 201,
      metadata: { name: organization.organizationName },
    });

    c.set("orgId", organization.organizationId);
    c.set("orgRole", organization.membershipRole);
    c.set("memberships", organizations);

    return c.json(
      {
        organization,
        currentOrganizationId: organization.organizationId,
        organizations,
      },
      201
    );
  });

export default app;
