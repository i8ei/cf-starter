#!/usr/bin/env node

import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const tempRoot = await mkdtemp(join(tmpdir(), "create-cf-starter-smoke-"));
const targetDir = join(tempRoot, "smoke-app");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      ...options.env,
    },
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      [`Command failed: ${command} ${args.join(" ")}`, stderr, stdout].filter(Boolean).join("\n")
    );
  }

  return result;
}

try {
  run(process.execPath, ["scripts/create-cf-starter.mjs", targetDir, "--exclude", "kv,upload"], {
    cwd: REPO_ROOT,
  });

  const generatedPackage = JSON.parse(await readFile(join(targetDir, "package.json"), "utf8"));
  if (generatedPackage.name !== "smoke-app") {
    throw new Error(`Generated package name mismatch: ${generatedPackage.name}`);
  }
  if (generatedPackage.bin) {
    throw new Error("Generated app package.json must not keep the CLI bin entry");
  }

  await symlink(join(REPO_ROOT, "node_modules"), join(targetDir, "node_modules"), "dir");
  run("npm", ["run", "build"], { cwd: targetDir });

  console.log(`test:create passed for ${targetDir}`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
