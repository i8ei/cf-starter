import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];
const scriptPath = join(process.cwd(), "scripts/create-cf-starter.mjs");
const npmCacheDir = join(tmpdir(), "create-cf-starter-npm-cache");

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("create-cf-starter", () => {
  it("prints help text", () => {
    const result = spawnSync(process.execPath, [scriptPath, "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: create-cf-starter <target> [options]");
    expect(result.stdout).toContain("--core-only");
    expect(result.stdout).toContain("--include <list>");
    expect(result.stdout).toContain("--starter");
    expect(result.stdout).toContain("compatibility shortcut");
    expect(result.stdout).toContain("--plan");
  });

  it("fails with usage text when target is missing", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage: create-cf-starter <target> [options]");
  });

  it("fails gracefully on unknown options", () => {
    const result = spawnSync(process.execPath, [scriptPath, "regional-ops", "--wat"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unknown option '--wat'");
    expect(result.stderr).toContain("Usage: create-cf-starter <target> [options]");
  });

  it("returns plan JSON for dry-run", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "create-cf-starter-plan-"));
    const planOut = join(targetParent, "plan.json");
    tempDirs.push(targetParent);

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        join(targetParent, "regional-ops"),
        "--plan",
        "--json",
        "--plan-out",
        planOut,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('[deprecated] JSON field "mode" remains for compatibility.');
    const stdoutJson = JSON.parse(result.stdout);
    expect(stdoutJson.mode).toBe("core-only");
    expect(stdoutJson.profile).toBe("core-only");
    expect(stdoutJson.selectedFeatures).toEqual([]);
    expect(stdoutJson.coreBindingsKept).toEqual(["DB", "JOBS", "RATE_LIMITER"]);

    const savedJson = JSON.parse(await readFile(planOut, "utf8"));
    expect(savedJson.filesRemoved).toContain("examples/");
  });

  it("works through npx dot entrypoint", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "create-cf-starter-npx-"));
    const target = join(targetParent, "regional-ops");
    tempDirs.push(targetParent);

    const result = spawnSync(
      "npx",
      [".", target, "--plan", "--json"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          NPM_CONFIG_CACHE: npmCacheDir,
        },
      }
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('[deprecated] JSON field "mode" remains for compatibility.');
    const stdoutJson = JSON.parse(result.stdout);
    expect(stdoutJson.mode).toBe("core-only");
    expect(stdoutJson.profile).toBe("core-only");
    expect(stdoutJson.selectedFeatures).toEqual([]);
  }, 10000);

  it("scaffolds an app and prints next steps", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "create-cf-starter-app-"));
    const target = join(targetParent, "regional-ops");
    tempDirs.push(targetParent);

    const result = spawnSync(
      process.execPath,
      [scriptPath, target],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Scaffolded regional-ops");
    expect(result.stdout).toContain("Feature profile: core-only");
    expect(result.stdout).toContain("Next steps:");
    expect(result.stdout).toContain("Run npm run doctor");
    expect(result.stdout).toContain("Set real d1 database_id and queue name in wrangler.jsonc");
    expect(result.stdout).not.toContain("Create or wire the KV namespace");
    expect(result.stdout).not.toContain("Create or wire the R2 bucket");
    expect(await readFile(join(target, "README.md"), "utf8")).toContain("# regional-ops");
    expect(await readFile(join(target, "README.md"), "utf8")).toContain("core-only 構成");
  });

  it("uses the package template even when invoked outside the repo cwd", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "create-cf-starter-cwd-"));
    const workDir = await mkdtemp(join(tmpdir(), "create-cf-starter-work-"));
    const target = join(targetParent, "regional-ops");
    tempDirs.push(targetParent, workDir);

    const result = spawnSync(
      process.execPath,
      [scriptPath, target],
      {
        cwd: workDir,
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    const generatedPackage = await readFile(join(target, "package.json"), "utf8");
    expect(generatedPackage).toContain('"name": "regional-ops"');
    expect(generatedPackage).not.toContain('"bin"');
  });

  it("keeps starter mode when explicitly requested", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "create-cf-starter-starter-"));
    tempDirs.push(targetParent);

    const result = spawnSync(
      process.execPath,
      [scriptPath, join(targetParent, "regional-ops"), "--starter", "--plan", "--json"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('[deprecated] JSON field "mode" remains for compatibility.');
    const stdoutJson = JSON.parse(result.stdout);
    expect(stdoutJson.mode).toBe("starter");
    expect(stdoutJson.profile).toBe("optional-examples");
    expect(stdoutJson.selectedFeatures).toEqual(["items", "kv", "upload"]);
  });

  it("prints optional binding setup steps only when selected features need them", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "create-cf-starter-include-"));
    const target = join(targetParent, "regional-ops");
    tempDirs.push(targetParent);

    const result = spawnSync(
      process.execPath,
      [scriptPath, target, "--include", "upload"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Feature profile: optional examples: upload");
    expect(result.stdout).toContain("Create or wire the R2 bucket");
    expect(result.stdout).not.toContain("Create or wire the KV namespace");
  });

  it("fails gracefully when the target directory already exists", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "create-cf-starter-existing-"));
    tempDirs.push(targetParent);

    const result = spawnSync(process.execPath, [scriptPath, targetParent], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("create-cf-starter failed: Refusing to overwrite existing directory");
  });
});
