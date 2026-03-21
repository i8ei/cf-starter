#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { printReport } from "./lib/cli-report.mjs";
import { buildDeployPlan } from "./lib/deploy.mjs";
import { execWrangler, readWranglerConfig } from "./lib/wrangler-config.mjs";

const { values } = parseArgs({
  options: {
    json: { type: "boolean" },
    plan: { type: "boolean" },
  },
});

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

const cwd = process.cwd();
const packageJson = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8"));
const { config } = await readWranglerConfig(cwd);
const pathStatuses = {
  "node_modules": await pathExists(resolve(cwd, "node_modules")),
  "node_modules/.bin/wrangler": await pathExists(resolve(cwd, "node_modules/.bin/wrangler")),
};

const planReport = buildDeployPlan({
  packageJson,
  config,
  pathStatuses,
});
const wantsJson = values.json;

if (values.plan) {
  printReport(planReport, { json: values.json });
  process.exit(planReport.ok ? 0 : 1);
}

if (!planReport.ok) {
  const report = {
    ...planReport,
    mode: "apply",
    summary: ["Deploy blocked because remote configuration is incomplete."],
    nextSteps: planReport.nextSteps?.length
      ? planReport.nextSteps
      : ["Run `npm run doctor -- --remote` and fix the failing checks."],
  };

  if (wantsJson) {
    printReport(report, { json: true });
  } else {
    printReport(report, { json: false });
  }
  process.exit(1);
}
const buildResult = spawnSync("npm", ["run", "build"], {
  cwd,
  stdio: wantsJson ? "pipe" : "inherit",
  encoding: "utf8",
});

if (buildResult.error) {
  const report = {
    ...planReport,
    ok: false,
    mode: "apply",
    summary: ["Build failed to start."],
    nextSteps: ["Verify npm is installed and rerun deploy."],
    error: {
      code: "build_spawn_failed",
      message: buildResult.error.message,
    },
    artifacts: {
      ...planReport.artifacts,
      build: {
        stdout: buildResult.stdout?.trim() ?? "",
        stderr: buildResult.stderr?.trim() ?? "",
      },
    },
  };

  if (wantsJson) {
    printReport(report, { json: true });
  } else {
    console.error(buildResult.error.message);
  }
  process.exit(1);
}

if ((buildResult.status ?? 1) !== 0) {
  const report = {
    ...planReport,
    ok: false,
    mode: "apply",
    summary: ["Build failed; deploy was not attempted."],
    nextSteps: ["Fix the build failure and rerun deploy."],
    artifacts: {
      ...planReport.artifacts,
      build: {
        stdout: buildResult.stdout?.trim() ?? "",
        stderr: buildResult.stderr?.trim() ?? "",
      },
    },
  };

  if (wantsJson) {
    printReport(report, { json: true });
  }
  process.exit(buildResult.status ?? 1);
}

const deployResult = execWrangler(["deploy"], {
  cwd,
  stdio: wantsJson ? "pipe" : "inherit",
});

if (deployResult.error) {
  const report = {
    ...planReport,
    ok: false,
    mode: "apply",
    summary: ["Wrangler deploy failed to start."],
    nextSteps: ["Verify Wrangler is installed and rerun deploy."],
    error: {
      code: "deploy_spawn_failed",
      message: deployResult.error.message,
    },
    artifacts: {
      ...planReport.artifacts,
      build: {
        stdout: buildResult.stdout?.trim() ?? "",
        stderr: buildResult.stderr?.trim() ?? "",
      },
      deploy: {
        stdout: deployResult.stdout?.trim() ?? "",
        stderr: deployResult.stderr?.trim() ?? "",
      },
    },
  };

  if (wantsJson) {
    printReport(report, { json: true });
  } else {
    console.error(deployResult.error.message);
  }
  process.exit(1);
}

const ok = (deployResult.status ?? 1) === 0;
const report = {
  ...planReport,
  ok,
  mode: "apply",
  summary: [ok ? "Build and deploy completed." : "Deploy failed after a successful build."],
  nextSteps: ok
    ? ["Verify the deployed worker and front-end in Cloudflare."]
    : ["Inspect Wrangler deploy output and rerun after fixing the issue."],
  artifacts: {
    ...planReport.artifacts,
    build: {
      stdout: buildResult.stdout?.trim() ?? "",
      stderr: buildResult.stderr?.trim() ?? "",
    },
    deploy: {
      stdout: deployResult.stdout?.trim() ?? "",
      stderr: deployResult.stderr?.trim() ?? "",
    },
  },
};

if (wantsJson) {
  printReport(report, { json: true });
}

process.exit(deployResult.status ?? 1);
