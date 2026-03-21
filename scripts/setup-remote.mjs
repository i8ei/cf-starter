#!/usr/bin/env node
/**
 * setup:remote — One-command remote deployment preparation.
 *
 * What it does:
 *   1. Run remote migrations (db:migrate:remote)
 *   2. Run seed:demo --remote (creates org id=1)
 *   3. Execute seed-app.sql if it exists (app-specific seed data)
 *   4. Check that required secrets are set
 *
 * Usage:
 *   npm run setup:remote
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { readWranglerConfig, getPrimaryD1DatabaseName, resolveWranglerBinary } from "./lib/wrangler-config.mjs";
import { inspectRemoteWebConfig } from "./lib/remote-config.mjs";
import { requiredSecretsForAuthMode } from "./lib/auth-mode.mjs";

const ROOT = resolve(import.meta.dirname, "..");

function run(cmd, args = [], opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: "utf-8", stdio: "inherit", ...opts });
}

function runOrDie(cmd, args, label) {
  const result = run(cmd, args);
  if ((result.status ?? 1) !== 0) {
    console.error(`\n✗ ${label} failed (exit ${result.status})`);
    process.exit(1);
  }
}

async function main() {
  const { config } = await readWranglerConfig(ROOT);
  const dbName = getPrimaryD1DatabaseName(config);
  if (!dbName) {
    console.error("d1_databases[0].database_name not found in wrangler.jsonc");
    process.exit(1);
  }

  const remoteWebConfig = inspectRemoteWebConfig(config.vars ?? {});
  if (
    !remoteWebConfig.appBaseUrlIsConfigured ||
    !remoteWebConfig.appBaseUrlUsesHttps ||
    remoteWebConfig.appBaseUrlIsLocal
  ) {
    console.error("APP_BASE_URL must be set to this app's production HTTPS origin before setup:remote.");
    process.exit(1);
  }
  if (
    !remoteWebConfig.hasRemoteCorsOrigin ||
    !remoteWebConfig.appBaseUrlIncludedInCors
  ) {
    console.error("CORS_ORIGIN must include the same production origin as APP_BASE_URL before setup:remote.");
    process.exit(1);
  }
  if (remoteWebConfig.corsRejected.length > 0) {
    console.error(`CORS_ORIGIN contains malformed origins that will crash the app at runtime: ${remoteWebConfig.corsRejected.join(", ")}`);
    console.error("Fix the invalid origins (check for trailing slashes, paths, or typos).");
    process.exit(1);
  }

  const wrangler = resolveWranglerBinary(ROOT);

  // ── Step 1: Remote migrations ──
  console.log("── Remote migrations ──");
  runOrDie("npm", ["run", "db:migrate:remote"], "db:migrate:remote");
  console.log("✓ Remote migrations applied\n");

  // ── Step 2: Remote seed:demo ──
  console.log("── Remote seed:demo ──");
  runOrDie("npm", ["run", "seed:demo", "--", "--remote"], "seed:demo --remote");
  console.log("✓ Remote demo data seeded\n");

  // ── Step 3: seed-app.sql (app-specific seed) ──
  const seedAppPath = resolve(ROOT, "seed-app.sql");
  if (existsSync(seedAppPath)) {
    console.log("── seed-app.sql (app-specific) ──");
    const result = run(wrangler, ["d1", "execute", dbName, "--remote", "--file", seedAppPath]);
    if ((result.status ?? 1) !== 0) {
      console.error("✗ seed-app.sql failed. Fix the SQL and retry.");
      process.exit(1);
    }
    console.log("✓ seed-app.sql applied to remote\n");
  } else {
    console.log("- No seed-app.sql found (optional)\n");
  }

  // ── Step 4: Check secrets ──
  console.log("── Secrets check ──");
  const vars = config.vars ?? {};
  const expectedSecrets = requiredSecretsForAuthMode(vars);

  if (expectedSecrets.length === 0) {
    console.log("- No required secrets for this configuration\n");
  } else {
    const listResult = run(wrangler, ["secret", "list", "--json"], { stdio: "pipe" });
    let setSecrets = [];
    if (listResult.status === 0) {
      try {
        setSecrets = JSON.parse(listResult.stdout).map((s) => s.name);
      } catch { /* ignore */ }
    }

    let allSet = true;
    for (const secret of expectedSecrets) {
      if (setSecrets.includes(secret)) {
        console.log(`✓ ${secret} is set`);
      } else {
        console.log(`⚠ ${secret} is NOT set → run: npx wrangler secret put ${secret}`);
        allSet = false;
      }
    }
    console.log();
    if (!allSet) {
      console.log("Set missing secrets before deploying.\n");
    }
  }

  // ── Done ──
  console.log("✅ Remote setup complete! Next: npm run deploy");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
