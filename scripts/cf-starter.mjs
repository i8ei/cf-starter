#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCliCommand } from "./lib/cli-router.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const route = resolveCliCommand(process.argv.slice(2));

if (!route.ok) {
  console.log(route.message);
  process.exit(route.exitCode);
}

const scriptPath = resolve(__dirname, route.script);
const result = spawnSync(process.execPath, [scriptPath, ...route.args], {
  cwd: process.cwd(),
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
