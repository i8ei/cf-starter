import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildScaffoldPlan, scaffoldStarter } from "./lib/scaffold.mjs";

const args = process.argv.slice(2);
const targetIndex = args.findIndex((arg) => arg === "--target");
const appNameIndex = args.findIndex((arg) => arg === "--app-name");
const coreOnly = args.includes("--core-only");
const force = args.includes("--force");
const asJson = args.includes("--json");
const planOnly = args.includes("--plan");
const includeIndex = args.findIndex((arg) => arg === "--include");
const excludeIndex = args.findIndex((arg) => arg === "--exclude");
const jsonOutIndex = args.findIndex((arg) => arg === "--json-out");
const planOutIndex = args.findIndex((arg) => arg === "--plan-out");

if (targetIndex === -1 || !args[targetIndex + 1]) {
  console.error("Usage: node scripts/scaffold-app.mjs --target <dir> [--core-only] [--force] [--plan] [--json]");
  process.exit(1);
}

const targetDir = resolve(process.cwd(), args[targetIndex + 1]);
const appName = appNameIndex === -1 ? undefined : args[appNameIndex + 1];
const include =
  includeIndex === -1 || !args[includeIndex + 1]
    ? undefined
    : args[includeIndex + 1].split(",").map((value) => value.trim()).filter(Boolean);
const exclude =
  excludeIndex === -1 || !args[excludeIndex + 1]
    ? undefined
    : args[excludeIndex + 1].split(",").map((value) => value.trim()).filter(Boolean);
const jsonOutPath =
  jsonOutIndex === -1 || !args[jsonOutIndex + 1]
    ? undefined
    : resolve(process.cwd(), args[jsonOutIndex + 1]);
const planOutPath =
  planOutIndex === -1 || !args[planOutIndex + 1]
    ? undefined
    : resolve(process.cwd(), args[planOutIndex + 1]);

if (planOutPath && !planOnly) {
  console.error("--plan-out can only be used together with --plan");
  process.exit(1);
}

const options = {
  targetDir,
  appName,
  coreOnly,
  include,
  exclude,
};
const result = planOnly
  ? buildScaffoldPlan(options)
  : await scaffoldStarter({
      sourceDir: process.cwd(),
      ...options,
      force,
    });

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else if (planOnly) {
  console.log(`Scaffold plan for ${result.appName} (${result.mode})`);
  console.log(`Target: ${result.targetDir}`);
  console.log(`Selected features: ${result.selectedFeatures.length > 0 ? result.selectedFeatures.join(", ") : "none"}`);
  console.log(`Required bindings: ${result.requiredBindings.join(", ")}`);
  if (result.bindingsRemoved.length > 0) {
    console.log(`Bindings removed: ${result.bindingsRemoved.join(", ")}`);
  }
  if (result.removedFeatures.length > 0) {
    console.log(`Removed features: ${result.removedFeatures.join(", ")}`);
  }
  if (result.filesRemoved.length > 0) {
    console.log(`Files removed: ${result.filesRemoved.join(", ")}`);
  }
  console.log(`Files rewritten: ${result.filesRewritten.join(", ")}`);
  if (result.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }
  console.log("Transforms:");
  for (const transform of result.transforms) {
    console.log(`- ${transform}`);
  }
  console.log("Next steps:");
  for (const step of result.nextSteps) {
    console.log(`- ${step}`);
  }
} else {
  console.log(`Scaffolded ${result.mode} app at ${result.targetDir}`);
}

if (jsonOutPath) {
  await writeFile(jsonOutPath, `${JSON.stringify(result, null, 2)}\n`);
}

if (planOutPath) {
  await writeFile(planOutPath, `${JSON.stringify(result, null, 2)}\n`);
}
