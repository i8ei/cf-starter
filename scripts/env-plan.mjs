#!/usr/bin/env node

import { parseArgs } from "node:util";
import { printReport } from "./lib/cli-report.mjs";
import { buildEnvPlan } from "./lib/env-plan.mjs";
import { readWranglerConfig } from "./lib/wrangler-config.mjs";

const { values } = parseArgs({
  options: {
    json: { type: "boolean" },
  },
});

try {
  const { config } = await readWranglerConfig(process.cwd());
  const report = buildEnvPlan({ config });
  printReport(report, { json: values.json });
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  const report = {
    ok: false,
    command: "env plan",
    mode: "plan",
    target: "config",
    summary: ["Environment planning failed before wrangler.jsonc could be analyzed."],
    checks: [],
    warnings: [],
    nextSteps: ["Fix the wrangler.jsonc error and rerun env plan."],
    error: {
      code: "env_plan_failed",
      message: error instanceof Error ? error.message : String(error),
    },
  };
  printReport(report, { json: values.json });
  process.exit(1);
}
