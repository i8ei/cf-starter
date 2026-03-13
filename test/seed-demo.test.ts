import { describe, expect, it } from "vitest";
import { buildSeedDemoPlan } from "../scripts/lib/seed-demo.mjs";

describe("buildSeedDemoPlan", () => {
  it("builds a local seed plan without leaking credentials by default", () => {
    const report = buildSeedDemoPlan({
      mode: "--local",
      email: "demo@example.com",
      name: "Demo User",
      organizationName: "Demo User Workspace",
      organizationSlug: "demo-demo-user",
      password: "demo1234",
      config: {},
    });

    expect(report.ok).toBe(true);
    expect(report.command).toBe("db seed-demo");
    expect(report.mode).toBe("plan");
    expect(report.target).toBe("local");
    expect(report.summary[0]).toContain("upsert 1 user");
    expect(report.changes).toHaveLength(3);
    expect(report.artifacts.credentials).toBeUndefined();
  });

  it("adds remote warning and opt-in credentials when requested", () => {
    const report = buildSeedDemoPlan({
      mode: "--remote",
      email: "demo@example.com",
      name: "Demo User",
      organizationName: "Demo User Workspace",
      organizationSlug: "demo-demo-user",
      password: "demo1234",
      includeCredentials: true,
      config: {
        d1_databases: [{ database_id: "TODO" }],
      },
    });

    expect(report.warnings).toContain(
      "Remote seed may fail because d1_databases[0].database_id is not set."
    );
    expect(report.artifacts.credentials).toEqual({
      email: "demo@example.com",
      password: "demo1234",
    });
  });
});
