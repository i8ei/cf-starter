import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildGeneratedAppTemplateSnapshot,
  buildGeneratedAppTemplateSnapshotReport,
} from "../scripts/lib/template-snapshot.mjs";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("template snapshot", () => {
  it("captures a core-only generated app shape without example roots", () => {
    const snapshot = buildGeneratedAppTemplateSnapshot({
      appName: "regional-ops",
      coreOnly: true,
    });

    expect(snapshot.profile).toBe("core-only");
    expect(snapshot.selectedFeatures).toEqual([]);
    expect(snapshot.expectedTemplateRootPaths).not.toContain("examples");
    expect(snapshot.selectedOptionalPaths).toEqual([]);
    expect(snapshot.filesRemoved).toContain("examples");
    expect(snapshot.generatedAppRuntimeScriptPaths).toContain("scripts/doctor.mjs");
  });

  it("matches the committed core-only snapshot fixture", async () => {
    const snapshot = buildGeneratedAppTemplateSnapshot({
      appName: "regional-ops",
      coreOnly: true,
    });
    const fixture = JSON.parse(
      await readFile(join(process.cwd(), "test/fixtures/template-snapshots/core-only.json"), "utf8")
    );

    expect(snapshot).toEqual(fixture);
  });

  it("matches the committed items+upload snapshot fixture and script output", async () => {
    const expected = JSON.parse(
      await readFile(join(process.cwd(), "test/fixtures/template-snapshots/items-upload.json"), "utf8")
    );
    const snapshot = buildGeneratedAppTemplateSnapshot({
      appName: "regional-ops",
      include: ["items", "upload"],
    });

    expect(snapshot).toEqual(expected);

    const dir = await mkdtemp(join(tmpdir(), "cf-starter-template-snapshot-"));
    tempDirs.push(dir);
    const outputPath = join(dir, "snapshot.json");

    const result = spawnSync(
      "node",
      [
        "scripts/internal/snapshot-template.mjs",
        "--app-name",
        "regional-ops",
        "--include",
        "items,upload",
        "--write",
        outputPath,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    const stdoutJson = JSON.parse(result.stdout);
    const writtenJson = JSON.parse(await readFile(outputPath, "utf8"));

    expect(stdoutJson).toEqual({
      action: "template-snapshot",
      sourceKind: "checked-in-template",
      profile: expected.profile,
      selectedFeatures: expected.selectedFeatures,
      requiredBindings: expected.requiredBindings,
      summary: {
        templateRootPathCount: expected.expectedTemplateRootPaths.length,
        optionalPathCount: expected.selectedOptionalPaths.length,
        runtimeScriptCount: expected.generatedAppRuntimeScriptPaths.length,
        removedPathCount: expected.filesRemoved.length,
        rewrittenPathCount: expected.filesRewritten.length,
      },
    });
    expect(writtenJson).toEqual(stdoutJson);
  });

  it("adds sourceKind to the internal snapshot report", async () => {
    const report = await buildGeneratedAppTemplateSnapshotReport({
      sourceDir: process.cwd(),
      appName: "regional-ops",
      include: ["items", "upload"],
    });

    expect(report.sourceKind).toBe("checked-in-template");
    expect(report.selectedFeatures).toEqual(["items", "upload"]);
  });

  it("emits verbose snapshot details when requested", async () => {
    const result = spawnSync(
      "node",
      [
        "scripts/internal/snapshot-template.mjs",
        "--app-name",
        "regional-ops",
        "--include",
        "items,upload",
        "--verbose",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(0);
    const stdoutJson = JSON.parse(result.stdout);

    expect(stdoutJson.action).toBe("template-snapshot");
    expect(stdoutJson.details.sourceKind).toBe("checked-in-template");
    expect(stdoutJson.details.selectedFeatures).toEqual(["items", "upload"]);
  });
});
