import { createMiddleware } from "hono/factory";
import type { AppContextEnv, OrgRole } from "../types";
import { writeAuditLog } from "../lib/audit";
import { jsonError } from "../lib/http";
import { logRequestEvent } from "../lib/logging";

const ORGANIZATION_ADMIN_ROLES: readonly OrgRole[] = ["owner", "admin"] as const;

function hasRequiredOrganizationRole(
  assignedRole: OrgRole | null | undefined,
  requiredRoles: readonly OrgRole[]
): boolean {
  return !!assignedRole && (requiredRoles as readonly string[]).includes(assignedRole);
}

export function requireOrgRole(
  requiredRoles: readonly OrgRole[] = ORGANIZATION_ADMIN_ROLES
) {
  return createMiddleware<AppContextEnv>(async (c, next) => {
    const userId = c.get("userId");
    const organizationId = c.get("orgId");
    const organizationRole = c.get("orgRole") ?? null;

    if (!userId || !organizationId) {
      return jsonError(c, 401, "unauthorized", "Authentication required");
    }

    if (!hasRequiredOrganizationRole(organizationRole, requiredRoles)) {
      logRequestEvent("warn", "auth.org_role_forbidden", c, {
        userId,
        organizationId,
        organizationRole,
        requiredRoles,
      });

      await writeAuditLog(c.env.DB, c, {
        actorUserId: userId,
        organizationId,
        action: "auth.org_role_forbidden",
        resourceType: "authorization",
        status: 403,
        metadata: {
          organizationRole,
          requiredRoles,
        },
      });

      return jsonError(c, 403, "organization_forbidden", "Forbidden");
    }

    await next();
  });
}
