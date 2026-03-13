import { describe, expect, it } from "vitest";
import { buildMigrationPlan } from "../scripts/lib/d1-migrate.mjs";

describe("buildMigrationPlan", () => {
  it("builds a remote migration plan with warnings for incomplete remote config", () => {
    const report = buildMigrationPlan({
      dbName: "cf-starter-db",
      mode: "--remote",
      cwd: "/tmp/cf-starter",
      localMigrations: ["0001_init.sql", "0002_auth.sql"],
      featureMigrations: ["0010_example_items.sql"],
      config: {
        d1_databases: [
          {
            database_id: "TODO",
          },
        ],
      },
    });

    expect(report.ok).toBe(true);
    expect(report.command).toBe("db migrate");
    expect(report.mode).toBe("plan");
    expect(report.target).toBe("remote");
    expect(report.summary[0]).toContain("3 migration file(s)");
    expect(report.changes).toHaveLength(3);
    expect(report.warnings).toContain(
      "Remote apply may fail because d1_databases[0].database_id is not set."
    );
  });
});
