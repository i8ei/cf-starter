import { describe, expect, it } from "vitest";
import { analyzeDoctorContext } from "../scripts/lib/doctor.mjs";

describe("analyzeDoctorContext", () => {
  it("passes with complete local prerequisites and warning-level remote TODOs", () => {
    const report = analyzeDoctorContext({
      nodeVersion: "20.11.1",
      packageJson: {
        scripts: {
          doctor: "node scripts/doctor.mjs",
          "db:migrate": "node scripts/d1-migrate.mjs",
          "db:migrate:remote": "node scripts/d1-migrate.mjs --remote",
          "seed:demo": "node scripts/seed-demo.mjs",
          "record:generate": "node scripts/generate-record.mjs",
        },
        devDependencies: {
          wrangler: "^4",
        },
      },
      wranglerConfig: {
        d1_databases: [
          {
            database_name: "cf-starter-db",
            database_id: "TODO",
          },
        ],
        r2_buckets: [{ binding: "BUCKET", bucket_name: "cf-starter-bucket" }],
        vars: {
          APP_BASE_URL: "http://localhost:5173",
          EMAIL_FROM: "cf-starter <noreply@example.com>",
        },
      },
      pathStatuses: {
        "README.md": true,
        "wrangler.jsonc": true,
        migrations: true,
        node_modules: true,
        "node_modules/.bin/wrangler": true,
        "scripts/d1-migrate.mjs": true,
        "scripts/generate-record.mjs": true,
        "scripts/lib/wrangler-config.mjs": true,
        "scripts/lib/example-migrations.mjs": true,
        "shared/records/task.ts": true,
      },
    });

    expect(report.ok).toBe(true);
    expect(report.checks.find((check) => check.id === "node-version")?.level).toBe("pass");
    expect(report.checks.find((check) => check.id === "d1-database-id")?.level).toBe("warn");
    expect(report.warnings).toContain("d1_databases[0].database_id is still TODO.");
  });

  it("adds remote-specific checks and whoami probe results", () => {
    const report = analyzeDoctorContext({
      nodeVersion: "20.11.1",
      target: "remote",
      remoteProbe: {
        ok: false,
        message: "Wrangler whoami did not succeed.",
      },
      packageJson: {
        scripts: {
          doctor: "node scripts/doctor.mjs",
          "db:migrate": "node scripts/d1-migrate.mjs",
          "db:migrate:remote": "node scripts/d1-migrate.mjs --remote",
          "seed:demo": "node scripts/seed-demo.mjs",
          "record:generate": "node scripts/generate-record.mjs",
        },
        devDependencies: {
          wrangler: "^4",
        },
      },
      wranglerConfig: {
        d1_databases: [
          {
            database_name: "cf-starter-db",
            database_id: "TODO",
          },
        ],
        r2_buckets: [{ binding: "BUCKET", bucket_name: "cf-starter-bucket" }],
        vars: {
          APP_BASE_URL: "http://localhost:5173",
          EMAIL_FROM: "cf-starter <noreply@example.com>",
        },
      },
      pathStatuses: {
        "README.md": true,
        "wrangler.jsonc": true,
        migrations: true,
        node_modules: true,
        "node_modules/.bin/wrangler": true,
        "scripts/d1-migrate.mjs": true,
        "scripts/generate-record.mjs": true,
        "scripts/lib/wrangler-config.mjs": true,
        "scripts/lib/example-migrations.mjs": true,
        "shared/records/task.ts": true,
      },
    });

    expect(report.ok).toBe(true);
    expect(report.summary[0]).toContain("Remote deploy prerequisites");
    expect(report.checks.find((check) => check.id === "remote-app-base-url")?.level).toBe("warn");
    expect(report.checks.find((check) => check.id === "wrangler-auth")?.level).toBe("warn");
  });

  it("fails when core scripts and wrangler are missing", () => {
    const report = analyzeDoctorContext({
      nodeVersion: "18.19.0",
      packageJson: {
        scripts: {},
        devDependencies: {},
      },
      wranglerConfig: {},
      pathStatuses: {},
    });

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "node-version")?.level).toBe("fail");
    expect(report.checks.find((check) => check.id === "npm-scripts")?.level).toBe("fail");
    expect(report.checks.find((check) => check.id === "wrangler")?.level).toBe("fail");
  });
});
