import { mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("deprecated cli entrypoints", () => {
  it("warns for app-plan while keeping JSON output usable", () => {
    const result = spawnSync(process.execPath, ["scripts/compat/app-plan.mjs", "--json"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("[deprecated]");
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });

  it("warns for modules-plan while keeping JSON output usable", () => {
    const result = spawnSync(process.execPath, ["scripts/compat/modules-plan.mjs", "--json"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("[deprecated]");
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });

  it("warns for scaffold-app while keeping JSON output usable", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "cf-starter-deprecated-cli-"));
    tempDirs.push(targetParent);

    const result = spawnSync(
      process.execPath,
      ["scripts/compat/scaffold-app.mjs", "--target", join(targetParent, "regional-ops"), "--plan", "--json"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("[deprecated]");
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });
});
