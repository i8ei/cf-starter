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
        "--exclude",
        "kv,upload",
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
    const stdoutJson = JSON.parse(result.stdout);
    expect(stdoutJson.selectedFeatures).toEqual(["items"]);
    expect(stdoutJson.coreBindingsKept).toEqual(["DB", "JOBS", "RATE_LIMITER"]);

    const savedJson = JSON.parse(await readFile(planOut, "utf8"));
    expect(savedJson.bindingRemovalReasons.KV).toContain("kv example feature");
  });

  it("works through npx dot entrypoint", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "create-cf-starter-npx-"));
    const target = join(targetParent, "regional-ops");
    tempDirs.push(targetParent);

    const result = spawnSync(
      "npx",
      [".", target, "--plan", "--json", "--exclude", "kv,upload"],
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
    const stdoutJson = JSON.parse(result.stdout);
    expect(stdoutJson.selectedFeatures).toEqual(["items"]);
  });

  it("scaffolds an app and prints next steps", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "create-cf-starter-app-"));
    const target = join(targetParent, "regional-ops");
    tempDirs.push(targetParent);

    const result = spawnSync(
      process.execPath,
      [scriptPath, target, "--exclude", "kv,upload"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Scaffolded regional-ops (starter)");
    expect(result.stdout).toContain("Next steps:");
    expect(await readFile(join(target, "README.md"), "utf8")).toContain("# regional-ops");
  });

  it("uses the package template even when invoked outside the repo cwd", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "create-cf-starter-cwd-"));
    const workDir = await mkdtemp(join(tmpdir(), "create-cf-starter-work-"));
    const target = join(targetParent, "regional-ops");
    tempDirs.push(targetParent, workDir);

    const result = spawnSync(
      process.execPath,
      [scriptPath, target, "--exclude", "kv,upload"],
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
