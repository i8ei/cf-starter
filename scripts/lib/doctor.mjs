import { inspectRemoteWebConfig } from "./remote-config.mjs";
import { requiredSecretsForAuthMode } from "./auth-mode.mjs";

function hasScript(scripts, name) {
  return typeof scripts?.[name] === "string" && scripts[name].length > 0;
}

export function analyzeDoctorContext({
  nodeVersion,
  packageJson = {},
  wranglerConfig = {},
  pathStatuses = {},
  target = "local",
  remoteProbe = null,
}) {
  const checks = [];
  const scripts = packageJson.scripts ?? {};

  const majorVersion = Number.parseInt(String(nodeVersion).split(".")[0] ?? "0", 10);
  if (Number.isFinite(majorVersion) && majorVersion >= 20) {
    checks.push({
      id: "node-version",
      level: "pass",
      message: `Node.js ${nodeVersion} satisfies the >=20 requirement.`,
    });
  } else {
    checks.push({
      id: "node-version",
      level: "fail",
      message: `Node.js ${nodeVersion} does not satisfy the >=20 requirement.`,
      fix: "Install Node.js 20 or newer.",
    });
  }

  const coreScripts = ["doctor", "db:migrate", "db:migrate:remote", "seed:demo"];
  const missingCoreScripts = coreScripts.filter((name) => !hasScript(scripts, name));
  if (missingCoreScripts.length === 0) {
    checks.push({
      id: "npm-scripts",
      level: "pass",
      message: "Core npm scripts for doctor, migration, and seed are present.",
    });
  } else {
    checks.push({
      id: "npm-scripts",
      level: "fail",
      message: `Missing core npm scripts: ${missingCoreScripts.join(", ")}.`,
      fix: "Restore the missing scripts in package.json.",
    });
  }

  // Record Engine scripts are optional — warn if partially present
  if (!hasScript(scripts, "record:generate")) {
    const hasAnyRecordEngineFile = pathStatuses["scripts/generate-record.mjs"] || pathStatuses["shared/records/task.ts"];
    if (hasAnyRecordEngineFile) {
      checks.push({
        id: "record-engine-scripts",
        level: "warn",
        message: "record:generate script is missing but Record Engine files exist.",
        fix: "Restore the record:generate script or remove remaining Record Engine files.",
      });
    }
  }

  const corePaths = [
    "README.md",
    "wrangler.jsonc",
    "migrations",
    "scripts/d1-migrate.mjs",
    "scripts/lib/wrangler-config.mjs",
    "scripts/lib/example-migrations.mjs",
  ];
  const missingCorePaths = corePaths.filter((filePath) => !pathStatuses[filePath]);
  if (missingCorePaths.length === 0) {
    checks.push({
      id: "required-paths",
      level: "pass",
      message: "Required CLI, migration, and starter files are present.",
    });
  } else {
    checks.push({
      id: "required-paths",
      level: "fail",
      message: `Required files are missing: ${missingCorePaths.join(", ")}.`,
      fix: "Restore the missing files before running CLI workflows.",
    });
  }

  if (pathStatuses["node_modules"]) {
    checks.push({
      id: "node-modules",
      level: "pass",
      message: "node_modules is present.",
    });
  } else {
    checks.push({
      id: "node-modules",
      level: "warn",
      message: "node_modules is missing.",
      fix: "Run npm install before using Wrangler-backed scripts.",
    });
  }

  const hasWranglerDependency =
    typeof packageJson?.devDependencies?.wrangler === "string" ||
    typeof packageJson?.dependencies?.wrangler === "string";
  const hasWranglerBinary = Boolean(pathStatuses["node_modules/.bin/wrangler"]);
  if (hasWranglerDependency || hasWranglerBinary) {
    checks.push({
      id: "wrangler",
      level: "pass",
      message: "Wrangler is available through project dependencies.",
    });
  } else {
    checks.push({
      id: "wrangler",
      level: "fail",
      message: "Wrangler is not declared in package.json and no local binary was found.",
      fix: "Add wrangler to devDependencies and install dependencies.",
    });
  }

  const primaryDatabase = wranglerConfig?.d1_databases?.[0];
  if (!primaryDatabase) {
    checks.push({
      id: "d1-config",
      level: "fail",
      message: "wrangler.jsonc does not define d1_databases[0].",
      fix: "Add a primary D1 binding to wrangler.jsonc.",
    });
  } else if (!primaryDatabase.database_name) {
    checks.push({
      id: "d1-config",
      level: "fail",
      message: "d1_databases[0].database_name is missing.",
      fix: "Set d1_databases[0].database_name in wrangler.jsonc.",
    });
  } else {
    checks.push({
      id: "d1-config",
      level: "pass",
      message: `Primary D1 database is configured as ${primaryDatabase.database_name}.`,
    });
  }

  if (!primaryDatabase?.database_id || primaryDatabase.database_id === "TODO") {
    checks.push({
      id: "d1-database-id",
      level: "warn",
      message: "d1_databases[0].database_id is still TODO.",
      fix: "Write the real database_id after creating the remote D1 database.",
    });
  } else {
    checks.push({
      id: "d1-database-id",
      level: "pass",
      message: "Primary D1 database_id is set.",
    });
  }

  if (Array.isArray(wranglerConfig?.r2_buckets) && wranglerConfig.r2_buckets.length > 0) {
    checks.push({
      id: "r2-config",
      level: "pass",
      message: "R2 bucket bindings are configured.",
    });
  } else {
    checks.push({
      id: "r2-config",
      level: "warn",
      message: "No R2 bucket binding is configured.",
      fix: "Add an R2 bucket binding if file uploads are needed.",
    });
  }

  const hasRateLimiter = wranglerConfig?.durable_objects?.bindings?.some(
    (binding) => binding.name === "RATE_LIMITER",
  );
  if (hasRateLimiter) {
    checks.push({
      id: "rate-limiter",
      level: "pass",
      message: "RATE_LIMITER Durable Object binding is configured.",
    });
  } else {
    checks.push({
      id: "rate-limiter",
      level: "warn",
      message: "RATE_LIMITER Durable Object binding is not configured.",
      fix: "Enable durable_objects and its migration in wrangler.jsonc to rate-limit auth endpoints.",
    });
  }

  const vars = wranglerConfig?.vars ?? {};
  if (typeof vars.APP_BASE_URL === "string" && vars.APP_BASE_URL.length > 0) {
    checks.push({
      id: "app-base-url",
      level: "pass",
      message: `APP_BASE_URL is set to ${vars.APP_BASE_URL}.`,
    });
  } else {
    checks.push({
      id: "app-base-url",
      level: "warn",
      message: "APP_BASE_URL is not configured.",
      fix: "Set APP_BASE_URL in wrangler.jsonc vars.",
    });
  }

  if (typeof vars.EMAIL_FROM === "string" && vars.EMAIL_FROM.includes("cf-starter")) {
    checks.push({
      id: "email-from",
      level: "warn",
      message: "EMAIL_FROM still contains the default cf-starter value.",
      fix: "Replace EMAIL_FROM with a real sender before production use.",
    });
  } else if (typeof vars.EMAIL_FROM === "string" && vars.EMAIL_FROM.length > 0) {
    checks.push({
      id: "email-from",
      level: "pass",
      message: "EMAIL_FROM is customized.",
    });
  }

  if (target === "remote") {
    const remoteWebConfig = inspectRemoteWebConfig(vars);

    if (
      remoteWebConfig.appBaseUrlIsConfigured &&
      remoteWebConfig.appBaseUrlUsesHttps &&
      !remoteWebConfig.appBaseUrlIsLocal
    ) {
      checks.push({
        id: "remote-app-base-url",
        level: "pass",
        message: `APP_BASE_URL uses HTTPS for remote deploys (${remoteWebConfig.appBaseUrl}).`,
      });
    } else {
      checks.push({
        id: "remote-app-base-url",
        level: "fail",
        message: "APP_BASE_URL must be set to the deployed HTTPS origin for remote workflows.",
        fix: "Set APP_BASE_URL in wrangler.jsonc to the app's production HTTPS origin (not localhost).",
      });
    }

    if (
      remoteWebConfig.hasRemoteCorsOrigin &&
      remoteWebConfig.appBaseUrlIncludedInCors
    ) {
      checks.push({
        id: "remote-cors-origin",
        level: "pass",
        message: "CORS_ORIGIN includes the production origin for remote use.",
      });
    } else {
      checks.push({
        id: "remote-cors-origin",
        level: "fail",
        message: "CORS_ORIGIN must include the production origin before remote workflows.",
        fix: "Add the production URL to CORS_ORIGIN in wrangler.jsonc (for example 'http://localhost:5173, https://my-app.ichevi.workers.dev').",
      });
    }

    if (remoteWebConfig.corsRejected.length > 0) {
      checks.push({
        id: "remote-cors-invalid",
        level: "fail",
        message: `CORS_ORIGIN contains malformed origins that will crash the app at runtime: ${remoteWebConfig.corsRejected.join(", ")}`,
        fix: "Fix the invalid origins in CORS_ORIGIN (check for trailing slashes, paths, or typos).",
      });
    }

    // Required secrets check (auth-mode aware)
    const requiredSecrets = requiredSecretsForAuthMode(vars);
    if (requiredSecrets.length > 0 && remoteProbe) {
      checks.push({
        id: "remote-secrets-hint",
        level: "info",
        message: `Required secrets for this config: ${requiredSecrets.join(", ")}. Run \`npm run setup:remote\` to verify.`,
      });
    }

    if (remoteProbe?.ok === true) {
      checks.push({
        id: "wrangler-auth",
        level: "pass",
        message: remoteProbe.message ?? "Wrangler authentication check succeeded.",
      });
    } else if (remoteProbe?.ok === false) {
      checks.push({
        id: "wrangler-auth",
        level: "warn",
        message: remoteProbe.message ?? "Wrangler authentication check could not be confirmed.",
        fix: "Run `wrangler whoami` in a network-enabled shell and log in if required.",
      });
    }
  }

  const ok = !checks.some((check) => check.level === "fail");
  const warnings = checks.filter((check) => check.level === "warn").map((check) => check.message);
  const nextSteps = checks
    .filter((check) => check.level === "fail" || check.level === "warn")
    .map((check) => check.fix)
    .filter(Boolean);

  return {
    ok,
    checks,
    summary: ok
      ? [target === "remote" ? "Remote deploy prerequisites look usable." : "Local CLI prerequisites look usable."]
      : [
          target === "remote"
            ? "Remote deploy prerequisites need attention before production workflows will work."
            : "Local CLI prerequisites need attention before all workflows will work.",
        ],
    warnings,
    nextSteps,
  };
}
