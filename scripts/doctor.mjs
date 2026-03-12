#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { analyzeGeneratedApp } from "./lib/doctor.mjs";
import { GENERATED_APP_TRACKED_PATHS } from "./lib/starter-catalog.mjs";
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

const existingPaths = [];
for (const relativePath of GENERATED_APP_TRACKED_PATHS) {
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
