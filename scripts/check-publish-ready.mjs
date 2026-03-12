#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_PACKAGE_BYTES = 150 * 1024;
const MAX_UNPACKED_BYTES = 400 * 1024;
const FORBIDDEN_PACKED_PATH_PATTERNS = [
  /^\.env(\.|$)/,
  /(^|\/)\.env(\.|$)/,
  /\.(pem|key|crt|p12)$/i,
  /(^|\/)\.npmrc$/,
  /(^|\/)node_modules\//,
  /(^|\/)\.wrangler\//,
  /(^|\/)dist\//,
];
const FORBIDDEN_PACKED_PATHS = new Set([
  "ARCHITECTURE.md",
  "ROADMAP.md",
  "scripts/check-publish-ready.mjs",
  "scripts/test-create.mjs",
  "scripts/compat/app-plan.mjs",
  "scripts/compat/modules-plan.mjs",
  "scripts/compat/scaffold-app.mjs",
  "scripts/internal/app-plan.mjs",
  "scripts/internal/modules-plan.mjs",
  "scripts/lib/app-plan.mjs",
  "scripts/lib/deprecation.mjs",
  "scripts/lib/modules-plan.mjs",
  "test/create-cf-starter.test.ts",
  "test/deprecated-cli.test.ts",
  "test/doctor.test.ts",
  "test/module-plan.test.ts",
  "test/public-surface.test.ts",
  "test/scaffold.test.ts",
  "test/starter-manifest.test.ts",
]);

function fail(message) {
  console.error(`publish-ready check failed: ${message}`);
  process.exit(1);
}

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

if (packageJson.name !== "create-cf-starter") {
  fail(`package name must be create-cf-starter, got ${packageJson.name}`);
}
if (packageJson.license !== "UNLICENSED") {
  fail(`license must remain UNLICENSED until publish policy changes, got ${packageJson.license}`);
}
if (!packageJson.engines?.node) {
  fail("package.json must declare engines.node");
}
if (!packageJson.bin || packageJson.bin["create-cf-starter"] !== "bin/create-cf-starter") {
  fail("package.json must expose bin.create-cf-starter -> bin/create-cf-starter");
}
if (!Array.isArray(packageJson.files) || packageJson.files.length === 0) {
  fail("package.json must declare a files allowlist");
}

const packResult = spawnSync("npm", ["pack", "--json", "--dry-run"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    NPM_CONFIG_CACHE: join(tmpdir(), "create-cf-starter-npm-cache"),
  },
});

if (packResult.status !== 0) {
  fail(packResult.stderr || packResult.stdout || "npm pack --json --dry-run failed");
}

const packOutput = JSON.parse(packResult.stdout);
const packInfo = Array.isArray(packOutput) ? packOutput[0] : packOutput;
const files = Array.isArray(packInfo.files) ? packInfo.files.map((file) => file.path) : [];

if (!files.includes("bin/create-cf-starter")) {
  fail("published tarball is missing bin/create-cf-starter");
}
if (!files.includes("scripts/create-cf-starter.mjs")) {
  fail("published tarball is missing scripts/create-cf-starter.mjs");
}
if (packInfo.size > MAX_PACKAGE_BYTES) {
  fail(`package size ${packInfo.size} exceeds ${MAX_PACKAGE_BYTES} bytes`);
}
if (packInfo.unpackedSize > MAX_UNPACKED_BYTES) {
  fail(`unpacked size ${packInfo.unpackedSize} exceeds ${MAX_UNPACKED_BYTES} bytes`);
}

const forbiddenPath = files.find((file) =>
  FORBIDDEN_PACKED_PATH_PATTERNS.some((pattern) => pattern.test(file))
);
if (forbiddenPath) {
  fail(`forbidden file included in tarball: ${forbiddenPath}`);
}

const forbiddenStarterPath = files.find((file) => FORBIDDEN_PACKED_PATHS.has(file));
if (forbiddenStarterPath) {
  fail(`starter-only file included in tarball: ${forbiddenStarterPath}`);
}

console.log("publish-ready checks passed");
console.log(`package: ${packInfo.name}@${packInfo.version}`);
console.log(`size: ${packInfo.size} bytes`);
console.log(`unpacked: ${packInfo.unpackedSize} bytes`);
