import { describe, expect, it } from "vitest";
import { analyzeGeneratedApp, buildDoctorReport } from "../scripts/lib/doctor.mjs";
import {
  DOCTOR_REQUIRED_GENERATED_APP_PATHS,
  DOCTOR_REQUIRED_RUNTIME_PATHS,
  OPTIONAL_EXAMPLE_PATHS,
} from "../scripts/lib/starter-catalog.mjs";

function buildCleanGeneratedAppPaths() {
  return [
    ...DOCTOR_REQUIRED_GENERATED_APP_PATHS,
    ...DOCTOR_REQUIRED_RUNTIME_PATHS,
  ];
}

describe("doctor", () => {
  it("passes a clean generated app and warns on TODO ids", () => {
    const result = analyzeGeneratedApp({
      packageJson: {
        name: "regional-ops",
        scripts: {
          dev: "vite dev",
          doctor: "node scripts/doctor.mjs",
          "seed:demo": "node scripts/seed-demo.mjs",
        },
      },
      readme: "# regional-ops\n\nnpm run seed:demo\nnpm run doctor\n",
      wranglerConfig: {
        d1_databases: [{ database_id: "TODO" }],
        vars: { EMAIL_FROM: "regional-ops <noreply@example.com>" },
      },
      existingPaths: buildCleanGeneratedAppPaths(),
    });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.checks.some((check) => check.code === "database_id_todo" && check.level === "warn")).toBe(true);
    expect(result.checks.some((check) => check.code === "starter_files_absent" && check.level === "pass")).toBe(true);
    expect(result.checks.some((check) => check.code === "generated_app_paths_present" && check.level === "pass")).toBe(true);
    expect(result.checks.some((check) => check.code === "generated_app_runtime_present" && check.level === "pass")).toBe(true);
    expect(result.checks.some((check) => check.code === "example_residue_absent" && check.level === "pass")).toBe(true);
  });

  it("fails when starter residue remains", () => {
    const result = analyzeGeneratedApp({
      packageJson: {
        name: "regional-ops",
        scripts: {
          doctor: "node scripts/doctor.mjs",
          "seed:demo": "node scripts/seed-demo.mjs",
          "app:scaffold": "node scripts/compat/scaffold-app.mjs",
        },
      },
      readme: "# regional-ops\n\ncreate-cf-starter\n",
      wranglerConfig: {
        d1_databases: [{ database_id: "abc123" }],
      },
      existingPaths: [...buildCleanGeneratedAppPaths(), "scripts/compat/scaffold-app.mjs", "ARCHITECTURE.md"],
    });

    expect(result.ok).toBe(false);
    expect(result.checks.some((check) => check.code === "starter_files_present" && check.level === "fail")).toBe(true);
    expect(result.checks.some((check) => check.code === "starter_scripts_present" && check.level === "fail")).toBe(true);
    expect(result.checks.some((check) => check.code === "starter_readme_residue" && check.level === "fail")).toBe(true);
  });

  it("fails when core-first apps keep optional example residue and bindings", () => {
    const result = analyzeGeneratedApp({
      packageJson: {
        name: "regional-ops",
        scripts: {
          doctor: "node scripts/doctor.mjs",
          "seed:demo": "node scripts/seed-demo.mjs",
        },
      },
      readme: "# regional-ops\n",
      wranglerConfig: {
        d1_databases: [{ database_id: "abc123" }],
        kv_namespaces: [{ binding: "KV", id: "kv_123" }],
        r2_buckets: [{ binding: "BUCKET", bucket_name: "regional-ops-bucket" }],
      },
      existingPaths: [...buildCleanGeneratedAppPaths(), "examples", "examples/feature-packs", "examples/lib", "migrations/0010_example_items.sql"],
    });

    expect(result.ok).toBe(false);
    expect(result.checks.some((check) => check.code === "example_residue_present" && check.level === "fail")).toBe(true);
    expect(result.checks.some((check) => check.code === "items_migration_residue" && check.level === "fail")).toBe(true);
    expect(result.checks.some((check) => check.code === "kv_binding_residue" && check.level === "fail")).toBe(true);
    expect(result.checks.some((check) => check.code === "bucket_binding_residue" && check.level === "fail")).toBe(true);
  });

  it("fails when selected examples are missing their required bindings or migration", () => {
    const result = analyzeGeneratedApp({
      packageJson: {
        name: "regional-ops",
        scripts: {
          doctor: "node scripts/doctor.mjs",
          "seed:demo": "node scripts/seed-demo.mjs",
        },
      },
      readme: "# regional-ops\n",
      wranglerConfig: {
        d1_databases: [{ database_id: "abc123" }],
      },
      existingPaths: [
        ...buildCleanGeneratedAppPaths(),
        "examples",
        ...OPTIONAL_EXAMPLE_PATHS.items,
        ...OPTIONAL_EXAMPLE_PATHS.kv,
        ...OPTIONAL_EXAMPLE_PATHS.upload,
        "migrations/0010_example_items.sql",
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.checks.some((check) => check.code === "selected_examples_detected" && check.level === "pass")).toBe(true);
    expect(result.checks.some((check) => check.code === "items_migration_present" && check.level === "pass")).toBe(true);
    expect(result.checks.some((check) => check.code === "kv_binding_missing" && check.level === "fail")).toBe(true);
    expect(result.checks.some((check) => check.code === "bucket_binding_missing" && check.level === "fail")).toBe(true);
  });

  it("fails when required generated-app paths or runtime files are missing", () => {
    const result = analyzeGeneratedApp({
      packageJson: {
        name: "regional-ops",
        scripts: {
          doctor: "node scripts/doctor.mjs",
          "seed:demo": "node scripts/seed-demo.mjs",
        },
      },
      readme: "# regional-ops\n",
      wranglerConfig: {
        d1_databases: [{ database_id: "abc123" }],
      },
      existingPaths: ["README.md", "package.json", "scripts/doctor.mjs"],
    });

    expect(result.ok).toBe(false);
    expect(result.checks.some((check) => check.code === "missing_generated_app_paths" && check.level === "fail")).toBe(true);
    expect(result.checks.some((check) => check.code === "missing_generated_app_runtime" && check.level === "fail")).toBe(true);
  });

  it("skips checks inside the starter repository itself", () => {
    const result = analyzeGeneratedApp({
      packageJson: {
        name: "create-cf-starter",
        scripts: {},
      },
      existingPaths: ["bin/create-cf-starter"],
    });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.checks[0]?.code).toBe("starter_repo_detected");
  });

  it("builds a readable doctor report summary", () => {
    const result = analyzeGeneratedApp({
      packageJson: {
        name: "regional-ops",
        scripts: {
          doctor: "node scripts/doctor.mjs",
          "seed:demo": "node scripts/seed-demo.mjs",
        },
      },
      readme: "# regional-ops\n",
      wranglerConfig: {
        d1_databases: [{ database_id: "TODO" }],
      },
      existingPaths: buildCleanGeneratedAppPaths(),
    });

    const report = buildDoctorReport(result);

    expect(report.summary.pass).toBeGreaterThan(0);
    expect(report.summary.warn).toBeGreaterThan(0);
    expect(report.summary.fail).toBe(0);
    expect(report.lines[0]).toBe("PASS Generated app checks passed.");
    expect(report.lines[1]).toContain("Summary:");
    expect(report.lines.some((line) => line.startsWith("WARN wrangler.jsonc still has TODO"))).toBe(true);
  });

  it("builds an info report when run inside the starter repository", () => {
    const result = analyzeGeneratedApp({
      packageJson: {
        name: "create-cf-starter",
        scripts: {},
      },
      existingPaths: ["bin/create-cf-starter"],
    });

    const report = buildDoctorReport(result);

    expect(report.ok).toBe(true);
    expect(report.skipped).toBe(true);
    expect(report.summary.info).toBe(1);
    expect(report.lines[0]).toBe("INFO Starter repository detected; generated-app checks were skipped.");
    expect(report.lines[1]).toContain("Summary:");
  });
});
