import { resolve } from "node:path";
import { scaffoldStarter } from "./lib/scaffold.mjs";

const args = process.argv.slice(2);
const targetIndex = args.findIndex((arg) => arg === "--target");
const appNameIndex = args.findIndex((arg) => arg === "--app-name");
const coreOnly = args.includes("--core-only");
const force = args.includes("--force");
const asJson = args.includes("--json");
const includeIndex = args.findIndex((arg) => arg === "--include");
const excludeIndex = args.findIndex((arg) => arg === "--exclude");

if (targetIndex === -1 || !args[targetIndex + 1]) {
  console.error("Usage: node scripts/scaffold-app.mjs --target <dir> [--core-only] [--force] [--json]");
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

const result = await scaffoldStarter({
  sourceDir: process.cwd(),
  targetDir,
  appName,
  coreOnly,
  include,
  exclude,
  force,
});

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Scaffolded ${result.mode} app at ${result.targetDir}`);
}
