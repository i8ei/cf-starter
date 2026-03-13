#!/usr/bin/env node

import { stat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { printReport } from "./lib/cli-report.mjs";
import { analyzeDoctorContext } from "./lib/doctor.mjs";
import { execWrangler, readWranglerConfig } from "./lib/wrangler-config.mjs";

const { values } = parseArgs({
  options: {
    json: { type: "boolean" },
    remote: { type: "boolean" },
  },
});

function stripAnsi(input) {
  return input.replace(/\u001b\[[0-9;]*m/g, "");
}

function summarizeWranglerWhoami(output) {
  const cleaned = stripAnsi(output).trim();
  if (!cleaned) return "Wrangler whoami did not succeed.";

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const interesting = lines.find((line) => /Failed to fetch auth token|Not logged in|You are logged in|getaddrinfo|dash.cloudflare.com/i.test(line));
  return interesting ?? lines[0];
}

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
const target = values.remote ? "remote" : "local";

try {
  const packageJson = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8"));
  const { config: wranglerConfig } = await readWranglerConfig(cwd);

  const trackedPaths = [
    "README.md",
    "wrangler.jsonc",
    "migrations",
    "node_modules",
    "node_modules/.bin/wrangler",
    "scripts/d1-migrate.mjs",
    "scripts/generate-record.mjs",
    "scripts/lib/wrangler-config.mjs",
    "scripts/lib/example-migrations.mjs",
    "shared/records/task.ts",
  ];

  const pathStatuses = {};
  for (const relativePath of trackedPaths) {
    pathStatuses[relativePath] = await pathExists(resolve(cwd, relativePath));
  }

  let remoteProbe = null;
  if (target === "remote") {
    const whoami = execWrangler(["whoami"], {
      cwd,
      stdio: "pipe",
    });

    if (whoami.error) {
      remoteProbe = {
        ok: false,
        message: `Wrangler whoami could not start: ${whoami.error.message}`,
      };
    } else if ((whoami.status ?? 1) === 0) {
      const stdout = summarizeWranglerWhoami(whoami.stdout ?? "");
      remoteProbe = {
        ok: true,
        message: stdout ? `Wrangler authentication looks valid: ${stdout}` : "Wrangler authentication check succeeded.",
      };
    } else {
      const stderr = summarizeWranglerWhoami(whoami.stderr ?? whoami.stdout ?? "");
      remoteProbe = {
        ok: false,
        message: stderr || "Wrangler whoami did not succeed.",
      };
    }
  }

  const result = analyzeDoctorContext({
    nodeVersion: process.versions.node,
    packageJson,
    wranglerConfig,
    pathStatuses,
    target,
    remoteProbe,
  });

  const report = {
    command: "doctor",
    mode: "doctor",
    target,
    ...result,
  };

  printReport(report, { json: values.json });
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  const report = {
    ok: false,
    command: "doctor",
    mode: "doctor",
    target,
    summary: ["Doctor failed before checks could complete."],
    checks: [],
    warnings: [],
    nextSteps: ["Fix the error and rerun doctor."],
    error: {
      code: "doctor_failed",
      message: error instanceof Error ? error.message : String(error),
    },
  };

  printReport(report, { json: values.json });
  process.exit(1);
}
