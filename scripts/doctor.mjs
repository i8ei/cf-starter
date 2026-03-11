#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { analyzeGeneratedApp } from "./lib/doctor.mjs";
import { readWranglerConfig } from "./lib/wrangler-config.mjs";

const { values } = parseArgs({
  options: {
    json: { type: "boolean" },
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
const readmePath = resolve(cwd, "README.md");
const readme = (await pathExists(readmePath)) ? await readFile(readmePath, "utf8") : "";
const { config: wranglerConfig } = await readWranglerConfig(cwd);

const trackedPaths = [
  "bin/create-cf-starter",
  "examples",
  "examples/feature-packs",
  "examples/feature-packs/items/server",
  "examples/feature-packs/kv/server",
  "examples/feature-packs/upload/server",
  "examples/lib",
  "migrations/0010_example_items.sql",
  "scripts/check-publish-ready.mjs",
  "scripts/compat/app-plan.mjs",
  "scripts/compat/modules-plan.mjs",
  "scripts/compat/scaffold-app.mjs",
  "scripts/create-cf-starter.mjs",
  "scripts/internal/app-plan.mjs",
  "scripts/internal/modules-plan.mjs",
  "scripts/internal/scaffold-app.mjs",
  "scripts/lib/app-plan.mjs",
  "scripts/lib/modules-plan.mjs",
  "scripts/lib/scaffold.mjs",
  "scripts/lib/starter-manifest.mjs",
  "scripts/test-create.mjs",
  "test/create-cf-starter.test.ts",
  "test/deprecated-cli.test.ts",
  "test/doctor.test.ts",
  "test/module-plan.test.ts",
  "test/public-surface.test.ts",
  "test/scaffold.test.ts",
  "test/starter-manifest.test.ts",
  "ARCHITECTURE.md",
  "CLAUDE.md",
  "ROADMAP.md",
];

const existingPaths = [];
for (const relativePath of trackedPaths) {
  if (await pathExists(resolve(cwd, relativePath))) {
    existingPaths.push(relativePath);
  }
}

const result = analyzeGeneratedApp({
  packageJson,
  readme,
  wranglerConfig,
  existingPaths,
});

if (values.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const check of result.checks) {
    const prefix =
      check.level === "pass" ? "PASS" : check.level === "warn" ? "WARN" : check.level === "info" ? "INFO" : "FAIL";
    console.log(`${prefix} ${check.message}`);
  }
}

process.exit(result.ok ? 0 : 1);
