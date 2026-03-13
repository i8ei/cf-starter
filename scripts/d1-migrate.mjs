import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildMigrationPlan } from "./lib/d1-migrate.mjs";
import { materializeFeatureMigrations, listFeatureMigrations } from "./lib/example-migrations.mjs";
import { printReport } from "./lib/cli-report.mjs";
import { execWrangler, getPrimaryD1DatabaseName, readWranglerConfig } from "./lib/wrangler-config.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: "boolean" },
    local: { type: "boolean" },
    plan: { type: "boolean" },
    remote: { type: "boolean" },
  },
});

const mode = values.remote || positionals.includes("remote") ? "--remote" : "--local";
const cwd = process.cwd();
const { config } = await readWranglerConfig();
const dbName = getPrimaryD1DatabaseName(config);
if (!dbName) {
  console.error("d1_databases[0].database_name not found in wrangler.jsonc");
  process.exit(1);
}

async function listProjectMigrations(migrationsDir) {
  try {
    const entries = await import("node:fs/promises").then(({ readdir }) => readdir(migrationsDir));
    return entries.filter((entry) => entry.endsWith(".sql")).sort();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

const selectedFeatures = ["items", "kv", "upload"];
const localMigrations = await listProjectMigrations(resolve(cwd, "migrations"));
const featureMigrations = (await listFeatureMigrations(cwd, selectedFeatures)).map((migration) => migration.filename);

if (values.plan) {
  const report = buildMigrationPlan({
    dbName,
    mode,
    cwd,
    localMigrations,
    featureMigrations,
    config,
  });
  printReport(report, { json: values.json });
  process.exit(report.ok ? 0 : 1);
}

const tempDir = await mkdtemp(join(tmpdir(), "cf-starter-migrations-"));

try {
  await cp(resolve(cwd, "wrangler.jsonc"), join(tempDir, "wrangler.jsonc"));
  await cp(resolve(cwd, "migrations"), join(tempDir, "migrations"), { recursive: true });

  const copiedFeatureMigrations = await materializeFeatureMigrations({
    sourceDir: cwd,
    targetDir: tempDir,
    selectedFeatures,
    skipExisting: true,
  });

  const args = ["d1", "migrations", "apply", dbName, mode];
  if (mode === "--local") {
    args.push("--persist-to", resolve(cwd, ".wrangler/state"));
  }
  const wantsJson = values.json;
  const result = execWrangler(args, { stdio: wantsJson ? "pipe" : "inherit", cwd: tempDir });
  if (result.error) {
    if (wantsJson) {
      printReport(
        {
          ok: false,
          command: "db migrate",
          mode: "apply",
          target: mode === "--remote" ? "remote" : "local",
          summary: ["Wrangler failed to start."],
          checks: [],
          warnings: [],
          nextSteps: ["Verify Wrangler is installed and rerun the command."],
          error: {
            code: "wrangler_spawn_failed",
            message: result.error.message,
          },
        },
        { json: true }
      );
    } else {
      console.error(result.error.message);
    }
    process.exit(1);
  }

  if (wantsJson) {
    const report = {
      ...buildMigrationPlan({
        dbName,
        mode,
        cwd,
        localMigrations,
        featureMigrations,
        copiedFeatureMigrations,
        config,
      }),
      ok: (result.status ?? 1) === 0,
      mode: "apply",
      summary: [
        `Applied ${localMigrations.length + featureMigrations.length} migration file(s) to ${mode === "--remote" ? "remote" : "local"} D1.`,
      ],
      nextSteps:
        mode === "--remote"
          ? ["Deploy after confirming the remote schema is current."]
          : ["Start the app or run tests against the updated local D1 state."],
      artifacts: {
        executedCommand: ["wrangler", ...args],
        tempDir,
        copiedFeatureMigrations,
        stdout: result.stdout?.trim() ?? "",
        stderr: result.stderr?.trim() ?? "",
      },
    };
    printReport(report, { json: true });
  }

  process.exit(result.status ?? 1);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
