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
        "scripts/lib/wrangler-config.mjs": true,
        "scripts/lib/example-migrations.mjs": true,
      },
    });

    expect(report.ok).toBe(true);
    expect(report.checks.find((check) => check.id === "node-version")?.level).toBe("pass");
    expect(report.checks.find((check) => check.id === "d1-database-id")?.level).toBe("warn");
    expect(report.checks.find((check) => check.id === "rate-limiter")?.level).toBe("warn");
    expect(report.warnings).toContain("d1_databases[0].database_id is still TODO.");
    expect(report.warnings).toContain("RATE_LIMITER Durable Object binding is not configured.");
  });

  it("fails remote doctor when production web origins are still local-only", () => {
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
          CORS_ORIGIN: "http://localhost:5173",
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
        "scripts/lib/wrangler-config.mjs": true,
        "scripts/lib/example-migrations.mjs": true,
      },
    });

    expect(report.ok).toBe(false);
    expect(report.summary[0]).toContain("Remote deploy prerequisites");
    expect(report.checks.find((check) => check.id === "remote-app-base-url")?.level).toBe("fail");
    expect(report.checks.find((check) => check.id === "remote-cors-origin")?.level).toBe("fail");
    const hint = report.checks.find((check) => check.id === "remote-secrets-hint");
    expect(hint?.level).toBe("info");
    expect(hint?.message).toContain("BETTER_AUTH_SECRET");
    expect(report.checks.find((check) => check.id === "wrangler-auth")?.level).toBe("warn");
  });

  it("passes CORS check when production origin is included", () => {
    const report = analyzeDoctorContext({
      nodeVersion: "20.11.1",
      target: "remote",
      remoteProbe: { ok: true, message: "Logged in." },
      packageJson: {
        scripts: {
          doctor: "x",
          "db:migrate": "x",
          "db:migrate:remote": "x",
          "seed:demo": "x",
        },
        devDependencies: { wrangler: "^4" },
      },
      wranglerConfig: {
        d1_databases: [{ database_name: "my-db", database_id: "abc-123" }],
        r2_buckets: [{ binding: "BUCKET", bucket_name: "b" }],
        durable_objects: {
          bindings: [{ name: "RATE_LIMITER", class_name: "RateLimiter" }],
        },
        vars: {
          APP_BASE_URL: "https://my-app.ichevi.workers.dev",
          CORS_ORIGIN: "http://localhost:5173, https://my-app.ichevi.workers.dev",
          AUTH_ENABLED: "false",
        },
      },
      pathStatuses: {
        "README.md": true,
        "wrangler.jsonc": true,
        migrations: true,
        node_modules: true,
        "node_modules/.bin/wrangler": true,
        "scripts/d1-migrate.mjs": true,
        "scripts/lib/wrangler-config.mjs": true,
        "scripts/lib/example-migrations.mjs": true,
      },
    });

    expect(report.ok).toBe(true);
    expect(report.checks.find((check) => check.id === "remote-cors-origin")?.level).toBe("pass");
    expect(report.checks.find((check) => check.id === "remote-app-base-url")?.level).toBe("pass");
    expect(report.checks.find((check) => check.id === "rate-limiter")?.level).toBe("pass");
    // AUTH_ENABLED=false → no secrets hint
    expect(report.checks.find((check) => check.id === "remote-secrets-hint")).toBeUndefined();
  });

  it("reports BETTER_AUTH_SECRET for better-auth mode (default)", () => {
    const report = analyzeDoctorContext({
      nodeVersion: "20.11.1",
      target: "remote",
      remoteProbe: { ok: true, message: "Logged in." },
      packageJson: {
        scripts: { doctor: "x", "db:migrate": "x", "db:migrate:remote": "x", "seed:demo": "x", "record:generate": "x" },
        devDependencies: { wrangler: "^4" },
      },
      wranglerConfig: {
        d1_databases: [{ database_name: "my-db", database_id: "abc-123" }],
        r2_buckets: [{ binding: "BUCKET", bucket_name: "b" }],
        vars: {
          APP_BASE_URL: "https://my-app.ichevi.workers.dev",
          CORS_ORIGIN: "http://localhost:5173, https://my-app.ichevi.workers.dev",
        },
      },
      pathStatuses: {
        "README.md": true, "wrangler.jsonc": true, migrations: true, node_modules: true,
        "node_modules/.bin/wrangler": true, "scripts/d1-migrate.mjs": true,
        "scripts/generate-record.mjs": true, "scripts/lib/wrangler-config.mjs": true,
        "scripts/lib/example-migrations.mjs": true, "shared/records/task.ts": true,
      },
    });

    const hint = report.checks.find((check) => check.id === "remote-secrets-hint");
    expect(hint?.level).toBe("info");
    expect(hint?.message).toContain("BETTER_AUTH_SECRET");
  });

  it("reports ADMIN_PASSWORD for simple-admin mode", () => {
    const report = analyzeDoctorContext({
      nodeVersion: "20.11.1",
      target: "remote",
      remoteProbe: { ok: true, message: "Logged in." },
      packageJson: {
        scripts: { doctor: "x", "db:migrate": "x", "db:migrate:remote": "x", "seed:demo": "x", "record:generate": "x" },
        devDependencies: { wrangler: "^4" },
      },
      wranglerConfig: {
        d1_databases: [{ database_name: "my-db", database_id: "abc-123" }],
        r2_buckets: [{ binding: "BUCKET", bucket_name: "b" }],
        vars: {
          APP_BASE_URL: "https://my-app.ichevi.workers.dev",
          CORS_ORIGIN: "http://localhost:5173, https://my-app.ichevi.workers.dev",
          AUTH_MODE: "simple-admin",
        },
      },
      pathStatuses: {
        "README.md": true, "wrangler.jsonc": true, migrations: true, node_modules: true,
        "node_modules/.bin/wrangler": true, "scripts/d1-migrate.mjs": true,
        "scripts/generate-record.mjs": true, "scripts/lib/wrangler-config.mjs": true,
        "scripts/lib/example-migrations.mjs": true, "shared/records/task.ts": true,
      },
    });

    const hint = report.checks.find((check) => check.id === "remote-secrets-hint");
    expect(hint?.level).toBe("info");
    expect(hint?.message).toContain("ADMIN_PASSWORD");
  });

  it("fails when CORS_ORIGIN contains malformed origins (trailing slash)", () => {
    const report = analyzeDoctorContext({
      nodeVersion: "20.11.1",
      target: "remote",
      remoteProbe: { ok: true, message: "Logged in." },
      packageJson: {
        scripts: { doctor: "x", "db:migrate": "x", "db:migrate:remote": "x", "seed:demo": "x", "record:generate": "x" },
        devDependencies: { wrangler: "^4" },
      },
      wranglerConfig: {
        d1_databases: [{ database_name: "my-db", database_id: "abc-123" }],
        vars: {
          APP_BASE_URL: "https://my-app.ichevi.workers.dev",
          CORS_ORIGIN: "http://localhost:5173, https://my-app.ichevi.workers.dev, https://my-app.ichevi.workers.dev/",
        },
      },
      pathStatuses: {
        "README.md": true, "wrangler.jsonc": true, migrations: true, node_modules: true,
        "node_modules/.bin/wrangler": true, "scripts/d1-migrate.mjs": true,
        "scripts/generate-record.mjs": true, "scripts/lib/wrangler-config.mjs": true,
        "scripts/lib/example-migrations.mjs": true, "shared/records/task.ts": true,
      },
    });

    expect(report.ok).toBe(false);
    const invalid = report.checks.find((check) => check.id === "remote-cors-invalid");
    expect(invalid?.level).toBe("fail");
    expect(invalid?.message).toContain("https://my-app.ichevi.workers.dev/");
  });

  it("fails deploy plan when CORS_ORIGIN has malformed origins", async () => {
    const { buildDeployPlan } = await import("../scripts/lib/deploy.mjs");
    const report = buildDeployPlan({
      packageJson: { scripts: { build: "vite build" } },
      config: {
        vars: {
          APP_BASE_URL: "https://app.example.com",
          CORS_ORIGIN: "http://localhost:5173, https://app.example.com, https://app.example.com/",
        },
      },
      pathStatuses: { node_modules: true, "node_modules/.bin/wrangler": true },
    });

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "cors-invalid")?.level).toBe("fail");
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
