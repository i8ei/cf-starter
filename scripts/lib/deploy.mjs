import { inspectRemoteWebConfig } from "./remote-config.mjs";

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
  const vars = config?.vars ?? {};

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

  const remoteWebConfig = inspectRemoteWebConfig(vars);
  if (
    remoteWebConfig.appBaseUrlIsConfigured &&
    remoteWebConfig.appBaseUrlUsesHttps &&
    !remoteWebConfig.appBaseUrlIsLocal
  ) {
    checks.push({
      id: "app-base-url",
      level: "pass",
      message: `APP_BASE_URL is ready for remote deploys (${remoteWebConfig.appBaseUrl}).`,
    });
  } else {
    warnings.push("Deploy is blocked because APP_BASE_URL is not set to a production HTTPS origin.");
    checks.push({
      id: "app-base-url",
      level: "fail",
      message: "APP_BASE_URL must be set to the app's production HTTPS origin before deploy.",
      fix: "Set vars.APP_BASE_URL in wrangler.jsonc to the deployed HTTPS URL for this generated app.",
    });
  }

  if (
    remoteWebConfig.hasRemoteCorsOrigin &&
    remoteWebConfig.appBaseUrlIncludedInCors
  ) {
    checks.push({
      id: "cors-origin",
      level: "pass",
      message: "CORS_ORIGIN includes the production app origin.",
    });
  } else {
    warnings.push("Deploy is blocked because CORS_ORIGIN does not include the production origin.");
    checks.push({
      id: "cors-origin",
      level: "fail",
      message: "CORS_ORIGIN must include the same production origin used by APP_BASE_URL.",
      fix: "Add the deployed HTTPS app origin to vars.CORS_ORIGIN in wrangler.jsonc.",
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
