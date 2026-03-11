#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scaffoldScript = resolve(__dirname, "internal/scaffold-app.mjs");
const usage = [
  "Usage: create-cf-starter <target> [options]",
  "",
  "Options:",
  "  --core-only         Scaffold only starter core (default)",
  "  --include <list>    Keep only selected example features (comma-separated)",
  "  --exclude <list>    Remove selected example features (comma-separated)",
  "  --starter           Keep all bundled example features (compatibility shortcut)",
  "  --force             Overwrite existing target directory",
  "  --plan              Print scaffold plan without writing files",
  "  --json              Emit JSON output",
  "  --plan-out <file>   Write plan JSON to a file",
  "  --json-out <file>   Write scaffold result JSON to a file",
  "  --help              Show this help",
].join("\n");

let values;
let positionals;

try {
  ({ values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "core-only": { type: "boolean" },
      starter: { type: "boolean" },
      include: { type: "string" },
      exclude: { type: "string" },
      force: { type: "boolean" },
      plan: { type: "boolean" },
      json: { type: "boolean" },
      "plan-out": { type: "string" },
      "json-out": { type: "string" },
      help: { type: "boolean" },
    },
  }));
} catch (error) {
  const message = error instanceof Error ? error.message : "Invalid arguments.";
  console.error(message);
  console.error("");
  console.error(usage);
  process.exit(1);
}

if (values.help) {
  console.log(usage);
  process.exit(0);
}

if (positionals.length !== 1) {
  console.error(usage);
  process.exit(1);
}

const [target] = positionals;
const args = [scaffoldScript, "--target", target];

if (values["core-only"] && values.starter) {
  console.error("--core-only and --starter cannot be used together.");
  console.error("");
  console.error(usage);
  process.exit(1);
}

const usesFeatureSelection = Boolean(values.starter || values.include || values.exclude);
const shouldUseCoreOnly = values["core-only"] || !usesFeatureSelection;

if (shouldUseCoreOnly) args.push("--core-only");
if (values.include) args.push("--include", values.include);
if (values.exclude) args.push("--exclude", values.exclude);
if (values.force) args.push("--force");
if (values.plan) args.push("--plan");
if (values.json) args.push("--json");
if (values["plan-out"]) args.push("--plan-out", values["plan-out"]);
if (values["json-out"]) args.push("--json-out", values["json-out"]);

const result = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
