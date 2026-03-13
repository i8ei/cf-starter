function hasScript(scripts, name) {
  return typeof scripts?.[name] === "string" && scripts[name].length > 0;
}

export function buildDeployPlan({
  packageJson = {},
  config = {},
  pathStatuses = {},
}) {
  const scripts = packageJson.scripts ?? {};
  const warnings = [];
  const checks = [];

  if (hasScript(scripts, "build")) {
    checks.push({
      id: "build-script",
      level: "pass",
      message: "package.json has a build script.",
    });
  } else {
    checks.push({
      id: "build-script",
      level: "fail",
      message: "package.json is missing a build script.",
      fix: "Add a build script before using deploy.",
    });
  }

  const databaseId = config?.d1_databases?.[0]?.database_id;
  if (!databaseId || databaseId === "TODO") {
    warnings.push("Deploy may fail or be incomplete because d1_databases[0].database_id is not set.");
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

  const emailFrom = config?.vars?.EMAIL_FROM;
  if (typeof emailFrom === "string" && emailFrom.includes("cf-starter")) {
    warnings.push("EMAIL_FROM still contains the default cf-starter value.");
    checks.push({
      id: "email-from",
      level: "warn",
      message: "EMAIL_FROM still contains the default cf-starter value.",
      fix: "Replace EMAIL_FROM with a real sender before production use.",
    });
  }

  if (pathStatuses["node_modules"]) {
    checks.push({
      id: "node-modules",
      level: "pass",
      message: "node_modules is present.",
    });
  } else {
    warnings.push("node_modules is missing.");
    checks.push({
      id: "node-modules",
      level: "warn",
      message: "node_modules is missing.",
      fix: "Run npm install before deploying.",
    });
  }

  if (pathStatuses["node_modules/.bin/wrangler"]) {
    checks.push({
      id: "wrangler",
      level: "pass",
      message: "Local Wrangler binary is present.",
    });
  } else {
    warnings.push("Local Wrangler binary was not found in node_modules/.bin.");
    checks.push({
      id: "wrangler",
      level: "warn",
      message: "Local Wrangler binary was not found in node_modules/.bin.",
      fix: "Install dependencies or ensure Wrangler is available in PATH.",
    });
  }

  return {
    ok: !checks.some((check) => check.level === "fail"),
    command: "deploy",
    mode: "plan",
    target: "remote",
    summary: ["Deploy will run build first and then invoke Wrangler deploy."],
    checks,
    changes: [
      {
        kind: "step",
        action: "run",
        label: "npm run build",
      },
      {
        kind: "step",
        action: "run",
        label: "wrangler deploy",
      },
    ],
    warnings,
    nextSteps: [
      "Run without --plan to build and deploy the app.",
    ],
    artifacts: {
      appName: config?.name ?? packageJson?.name ?? null,
      workerEntry: config?.main ?? null,
    },
  };
}
