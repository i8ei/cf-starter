import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { memberships, organizations, sessions } from "../db/schema";
import type { OrganizationMembershipSummary } from "../types";

export const DEFAULT_ORGANIZATION_ROLE = "owner";

export function buildPersonalOrganizationName(name: string): string {
  return `${name}'s Workspace`;
}

export function slugifyOrganizationName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "workspace";
}

function buildUniqueOrganizationSlug(base: string): string {
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function getMembershipSummaries(
  db: ReturnType<typeof drizzle>,
  userId: number
): Promise<OrganizationMembershipSummary[]> {
  const rows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      organizationSlug: organizations.slug,
      membershipRole: memberships.role,
    })
    .from(memberships)
    .innerJoin(
      organizations,
      eq(memberships.organizationId, organizations.id)
    )
    .where(eq(memberships.userId, userId))
    .orderBy(asc(organizations.name), asc(organizations.id));

  return rows;
}

export function pickActiveMembership(
  membershipsList: OrganizationMembershipSummary[],
  requestedOrgId?: number | null
): OrganizationMembershipSummary | null {
  if (membershipsList.length === 0) return null;
  if (requestedOrgId === undefined || requestedOrgId === null) {
    return membershipsList[0] ?? null;
  }

  return (
    membershipsList.find(
      (membership) => membership.organizationId === requestedOrgId
    ) ?? membershipsList[0] ?? null
  );
}

export async function createOrganizationForUser(
  db: ReturnType<typeof drizzle>,
  userId: number,
  organizationName: string,
  role = DEFAULT_ORGANIZATION_ROLE
): Promise<OrganizationMembershipSummary> {
  const [organization] = await db
    .insert(organizations)
    .values({
      name: organizationName,
      slug: buildUniqueOrganizationSlug(slugifyOrganizationName(organizationName)),
    })
    .returning();

  await db.insert(memberships).values({
    organizationId: organization.id,
    userId,
    role,
  });

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    membershipRole: role,
  };
}

export async function ensurePersonalOrganization(
  db: ReturnType<typeof drizzle>,
  userId: number,
  displayName: string
): Promise<OrganizationMembershipSummary> {
  const existing = await getMembershipSummaries(db, userId);
  if (existing.length > 0) {
    return existing[0]!;
  }

  return createOrganizationForUser(
    db,
    userId,
    buildPersonalOrganizationName(displayName),
    DEFAULT_ORGANIZATION_ROLE
  );
}

export async function setSessionOrganization(
  db: ReturnType<typeof drizzle>,
  sessionId: string,
  organizationId: number
): Promise<void> {
  await db
    .update(sessions)
    .set({ currentOrgId: organizationId })
    .where(eq(sessions.id, sessionId));
}
