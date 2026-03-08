import { describe, expect, it } from "vitest";
import {
  buildPersonalOrganizationName,
  pickActiveMembership,
  slugifyOrganizationName,
} from "../src/lib/organizations";

describe("organizations", () => {
  it("builds a readable personal workspace name", () => {
    expect(buildPersonalOrganizationName("Taracho")).toBe("Taracho's Workspace");
  });

  it("slugifies organization names for URLs", () => {
    expect(slugifyOrganizationName("Taracho Regional Tools")).toBe(
      "taracho-regional-tools"
    );
    expect(slugifyOrganizationName("  !!!  ")).toBe("workspace");
  });

  it("selects the requested active organization when available", () => {
    const memberships = [
      {
        organizationId: 1,
        organizationName: "Alpha",
        organizationSlug: "alpha",
        membershipRole: "owner",
      },
      {
        organizationId: 2,
        organizationName: "Beta",
        organizationSlug: "beta",
        membershipRole: "member",
      },
    ];

    expect(pickActiveMembership(memberships, 2)?.organizationSlug).toBe("beta");
    expect(pickActiveMembership(memberships, 999)?.organizationSlug).toBe(
      "alpha"
    );
  });
});
