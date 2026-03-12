import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { materializeTemplateCandidate } from "../scripts/lib/template-candidate.mjs";
import {
  assertTemplateDirectoryMatches,
  buildTemplateDirectoryDiff,
  materializeTemplateDirectory,
} from "../scripts/lib/template-directory.mjs";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("template candidate", () => {
  it("materializes a core-only candidate without optional examples or scaffold support files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-template-core-"));
    tempDirs.push(dir);

    const result = await materializeTemplateCandidate({
      sourceDir: process.cwd(),
      targetDir: dir,
      appName: "regional-ops",
      coreOnly: true,
    });

    expect(result.profile).toBe("core-only");
    expect(result.sourceKind).toBe("checked-in-template");
    expect(await readFile(join(dir, "app/App.tsx"), "utf8")).toContain("HomePage");
    await expect(stat(join(dir, "examples"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(join(dir, "migrations/0010_example_items.sql"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(stat(join(dir, "scripts/create-cf-starter.mjs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(dir, "scripts/doctor.mjs"), "utf8")).toContain("node");
  });

  it("materializes only selected optional example content plus generated-app runtime scripts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-template-items-upload-"));
    tempDirs.push(dir);

    const result = await materializeTemplateCandidate({
      sourceDir: process.cwd(),
      targetDir: dir,
      appName: "regional-ops",
      include: ["items", "upload"],
    });

    expect(result.selectedFeatures).toEqual(["items", "upload"]);
    expect(await readFile(join(dir, "examples/feature-packs/items/server/routes.ts"), "utf8")).toContain(
      'action: "item.create"'
    );
    expect(await readFile(join(dir, "examples/feature-packs/upload/server/routes.ts"), "utf8")).toContain(
      'type: "upload.process"'
    );
    await expect(stat(join(dir, "examples/feature-packs/kv"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await stat(join(dir, "examples/lib"))).toBeTruthy();
    expect(await readFile(join(dir, "migrations/0010_example_items.sql"), "utf8")).toContain(
      "CREATE TABLE IF NOT EXISTS items"
    );
    await expect(stat(join(dir, "scripts/internal/scaffold-app.mjs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await stat(join(dir, "scripts/lib/record-engine.mjs"))).toBeTruthy();
  });

  it("supports partial fixture source trees through compatibility mode", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-template-partial-"));
    const targetDir = await mkdtemp(join(tmpdir(), "cf-starter-template-partial-target-"));
    tempDirs.push(sourceDir, targetDir);

    await writeFile(join(sourceDir, "package.json"), JSON.stringify({ name: "cf-starter" }, null, 2));
    await writeFile(join(sourceDir, "README.md"), "# cf-starter\n");
    await writeFile(join(sourceDir, "wrangler.jsonc"), '{ "name": "cf-starter" }\n');

    const result = await materializeTemplateCandidate({
      sourceDir,
      targetDir,
      appName: "regional-ops",
      include: ["items"],
      allowPartialSourceTree: true,
    });

    expect(result.selectedFeatures).toEqual(["items"]);
    expect(result.sourceKind).toBe("partial-source-tree");
    expect(await readFile(join(targetDir, "package.json"), "utf8")).toContain('"name": "cf-starter"');
    await expect(stat(join(targetDir, "examples"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(join(targetDir, "scripts/doctor.mjs"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("materializes a candidate tree through the internal helper script", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-template-script-"));
    tempDirs.push(dir);

    const result = spawnSync(
      "node",
      [
        "scripts/internal/materialize-template-candidate.mjs",
        "--source-dir",
        process.cwd(),
        "--target-dir",
        dir,
        "--app-name",
        "regional-ops",
        "--include",
        "kv",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    const summary = JSON.parse(result.stdout);

    expect(summary.action).toBe("template-materialize");
    expect(summary.selectedFeatures).toEqual(["kv"]);
    expect(summary.sourceKind).toBe("checked-in-template");
    expect(summary.summary.copiedPathCount).toBeGreaterThan(0);
    expect(summary).not.toHaveProperty("details");
    expect(await stat(join(dir, "examples/feature-packs/kv/server/routes.ts"))).toBeTruthy();
    await expect(stat(join(dir, "examples/feature-packs/items"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("emits verbose template materialization details when requested", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-template-script-verbose-"));
    tempDirs.push(dir);

    const result = spawnSync(
      "node",
      [
        "scripts/internal/materialize-template-candidate.mjs",
        "--source-dir",
        process.cwd(),
        "--target-dir",
        dir,
        "--app-name",
        "regional-ops",
        "--include",
        "kv",
        "--verbose",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    const summary = JSON.parse(result.stdout);

    expect(summary.action).toBe("template-materialize");
    expect(summary.details.selectedFeatures).toEqual(["kv"]);
    expect(summary.details.sourceKind).toBe("checked-in-template");
  });

  it("materializes a template directory without generated-app runtime scripts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-template-dir-"));
    tempDirs.push(dir);

    const result = await materializeTemplateDirectory({
      sourceDir: process.cwd(),
      targetDir: dir,
    });

    expect(result.selectedFeatures).toEqual(["items", "kv", "upload"]);
    expect(result.sourceKind).toBe("checked-in-template");
    expect(await stat(join(dir, "examples/feature-packs/items"))).toBeTruthy();
    expect(await stat(join(dir, "examples/feature-packs/kv"))).toBeTruthy();
    expect(await stat(join(dir, "examples/feature-packs/upload"))).toBeTruthy();
    await expect(stat(join(dir, "scripts/doctor.mjs"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(join(dir, "scripts/lib/starter-catalog.mjs"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(dir, "app/App.tsx"), "utf8")).toContain("HomePage");
  });

  it("syncs a template directory through the internal helper script", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-template-sync-"));
    tempDirs.push(dir);

    const result = spawnSync(
      "node",
      [
        "scripts/internal/sync-template-directory.mjs",
        "--source-dir",
        process.cwd(),
        "--target-dir",
        dir,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    const summary = JSON.parse(result.stdout);

    expect(summary.action).toBe("template-sync");
    expect(summary.selectedFeatures).toEqual(["items", "kv", "upload"]);
    expect(summary.sourceKind).toBe("checked-in-template");
    expect(summary.summary.copiedPathCount).toBeGreaterThan(0);
    expect(summary).not.toHaveProperty("details");
    expect(await stat(join(dir, "examples/feature-packs/items"))).toBeTruthy();
    await expect(stat(join(dir, "scripts/doctor.mjs"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("matches the checked-in template directory against a fresh materialization", async () => {
    const diff = await buildTemplateDirectoryDiff({
      sourceDir: process.cwd(),
      templateDir: join(process.cwd(), "template"),
    });

    expect(diff.matches).toBe(true);
    expect(diff.sourceKind).toBe("checked-in-template");
    expect(diff.missingFiles).toEqual([]);
    expect(diff.unexpectedFiles).toEqual([]);
    expect(diff.changedFiles).toEqual([]);
  });

  it("detects changed files in a template directory diff", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-template-diff-"));
    tempDirs.push(dir);

    await materializeTemplateDirectory({
      sourceDir: process.cwd(),
      targetDir: dir,
    });
    await rm(join(dir, "README.md"));

    const diff = await buildTemplateDirectoryDiff({
      sourceDir: process.cwd(),
      templateDir: dir,
    });

    expect(diff.matches).toBe(false);
    expect(diff.sourceKind).toBe("checked-in-template");
    expect(diff.missingFiles).toContain("README.md");
  });

  it("checks a template directory through the internal helper script", async () => {
    const result = spawnSync(
      "node",
      [
        "scripts/internal/check-template-directory.mjs",
        "--source-dir",
        process.cwd(),
        "--template-dir",
        join(process.cwd(), "template"),
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    const summary = JSON.parse(result.stdout);

    expect(summary.action).toBe("template-check");
    expect(summary.matches).toBe(true);
    expect(summary.sourceKind).toBe("checked-in-template");
    expect(summary.summary.changedCount).toBe(0);
    expect(summary).not.toHaveProperty("details");
  });

  it("emits verbose template check details when requested", async () => {
    const result = spawnSync(
      "node",
      [
        "scripts/internal/check-template-directory.mjs",
        "--source-dir",
        process.cwd(),
        "--template-dir",
        join(process.cwd(), "template"),
        "--verbose",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    const summary = JSON.parse(result.stdout);

    expect(summary.action).toBe("template-check");
    expect(summary.details.matches).toBe(true);
    expect(summary.details.changedFiles).toEqual([]);
  });

  it("throws a sync hint when the template directory drifts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-template-assert-"));
    tempDirs.push(dir);

    await materializeTemplateDirectory({
      sourceDir: process.cwd(),
      targetDir: dir,
    });
    await rm(join(dir, "README.md"));

    await expect(
      assertTemplateDirectoryMatches({
        sourceDir: process.cwd(),
        templateDir: dir,
      })
    ).rejects.toThrow("npm run template:sync");
  });
});
