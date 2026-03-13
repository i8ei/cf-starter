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

  const requiredScripts = ["doctor", "db:migrate", "db:migrate:remote", "seed:demo", "record:generate"];
  const missingScripts = requiredScripts.filter((name) => !hasScript(scripts, name));
  if (missingScripts.length === 0) {
    checks.push({
      id: "npm-scripts",
      level: "pass",
      message: "Core npm scripts for doctor, migration, seed, and record generation are present.",
    });
  } else {
    checks.push({
      id: "npm-scripts",
      level: "fail",
      message: `Missing core npm scripts: ${missingScripts.join(", ")}.`,
      fix: "Restore the missing scripts in package.json.",
    });
  }

  const requiredPaths = [
    "README.md",
    "wrangler.jsonc",
    "migrations",
    "scripts/d1-migrate.mjs",
    "scripts/generate-record.mjs",
    "scripts/lib/wrangler-config.mjs",
    "scripts/lib/example-migrations.mjs",
    "shared/records/task.ts",
  ];
  const missingPaths = requiredPaths.filter((filePath) => !pathStatuses[filePath]);
  if (missingPaths.length === 0) {
    checks.push({
      id: "required-paths",
      level: "pass",
      message: "Required CLI, migration, and starter files are present.",
    });
  } else {
    checks.push({
      id: "required-paths",
      level: "fail",
      message: `Required files are missing: ${missingPaths.join(", ")}.`,
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
    if (typeof vars.APP_BASE_URL === "string" && /^https:\/\//.test(vars.APP_BASE_URL)) {
      checks.push({
        id: "remote-app-base-url",
        level: "pass",
        message: `APP_BASE_URL uses HTTPS for remote deploys (${vars.APP_BASE_URL}).`,
      });
    } else {
      checks.push({
        id: "remote-app-base-url",
        level: "warn",
        message: "APP_BASE_URL is not using HTTPS for remote deploys.",
        fix: "Set APP_BASE_URL to the deployed HTTPS origin before production use.",
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
