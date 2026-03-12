import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveTemplateSource } from "../scripts/lib/template-source.mjs";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("template source", () => {
  it("detects the checked-in template tree when template/package.json is present", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-template-source-"));
    tempDirs.push(sourceDir);

    await mkdir(join(sourceDir, "template"), { recursive: true });
    await writeFile(join(sourceDir, "template/package.json"), '{ "name": "create-cf-starter" }\n');

    const result = await resolveTemplateSource(sourceDir);

    expect(result.templateDir).toBe(join(sourceDir, "template"));
    expect(result.allowPartialSourceTree).toBe(false);
    expect(result.sourceKind).toBe("checked-in-template");
  });

  it("falls back to compatibility mode when the template tree is absent or incomplete", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-template-source-partial-"));
    tempDirs.push(sourceDir);

    let result = await resolveTemplateSource(sourceDir);
    expect(result.templateDir).toBe(sourceDir);
    expect(result.allowPartialSourceTree).toBe(true);
    expect(result.sourceKind).toBe("partial-source-tree");

    await mkdir(join(sourceDir, "template"), { recursive: true });

    result = await resolveTemplateSource(sourceDir);
    expect(result.templateDir).toBe(sourceDir);
    expect(result.allowPartialSourceTree).toBe(true);
    expect(result.sourceKind).toBe("partial-source-tree");
  });
});
