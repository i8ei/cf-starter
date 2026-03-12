import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOCTOR_REQUIRED_GENERATED_APP_PATHS,
  DOCTOR_REQUIRED_RUNTIME_PATHS,
  GENERATED_APP_REMOVED_PATHS,
  OPTIONAL_EXAMPLE_PATHS,
} from "../scripts/lib/starter-catalog.mjs";
import {
  GENERATED_APP_RUNTIME_SCRIPT_PATHS,
  SCAFFOLD_RUNTIME_SUPPORT_PATHS,
  TEMPLATE_OPTIONAL_PATHS,
  TEMPLATE_ROOT_PATHS,
  normalizeTemplateManifestPath,
} from "../scripts/lib/template-manifest.mjs";

const repoRoot = process.cwd();

function isCoveredByRootPath(candidatePath, rootPath) {
  return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}/`);
}

describe("template manifest", () => {
  it("keeps template, generated-app runtime, and scaffold runtime surfaces disjoint", () => {
    const templateRoots = new Set(TEMPLATE_ROOT_PATHS.map(normalizeTemplateManifestPath));
    const generatedRuntime = new Set(
      GENERATED_APP_RUNTIME_SCRIPT_PATHS.map(normalizeTemplateManifestPath)
    );
    const scaffoldRuntime = new Set(SCAFFOLD_RUNTIME_SUPPORT_PATHS.map(normalizeTemplateManifestPath));

    for (const path of templateRoots) {
      expect(generatedRuntime.has(path)).toBe(false);
      expect(scaffoldRuntime.has(path)).toBe(false);
    }

    for (const path of generatedRuntime) {
      expect(scaffoldRuntime.has(path)).toBe(false);
    }
  });

  it("maps optional template paths onto current example feature directories", () => {
    expect(TEMPLATE_OPTIONAL_PATHS.items).toContain("migrations/0010_example_items.sql");
    expect(TEMPLATE_OPTIONAL_PATHS.items).toContain("examples/feature-packs/items");
    expect(TEMPLATE_OPTIONAL_PATHS.kv).toContain("examples/feature-packs/kv");
    expect(TEMPLATE_OPTIONAL_PATHS.upload).toContain("examples/feature-packs/upload");

    for (const featurePath of Object.values(OPTIONAL_EXAMPLE_PATHS).flat()) {
      const normalizedFeaturePath = normalizeTemplateManifestPath(featurePath);
      expect(
        Object.values(TEMPLATE_OPTIONAL_PATHS).some((candidatePaths) =>
          candidatePaths.some((candidatePath) =>
            isCoveredByRootPath(normalizedFeaturePath, normalizeTemplateManifestPath(candidatePath))
          )
        )
      ).toBe(true);
    }
  });

  it("keeps scaffold runtime support removable from generated apps and publish allowlist-compatible", async () => {
    const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
    const publishedPaths = packageJson.files.map(normalizeTemplateManifestPath);
    const removedPaths = new Set(GENERATED_APP_REMOVED_PATHS.map(normalizeTemplateManifestPath));

    for (const path of GENERATED_APP_RUNTIME_SCRIPT_PATHS) {
      expect(removedPaths.has(normalizeTemplateManifestPath(path))).toBe(false);
      expect(
        publishedPaths.some((publishedPath) =>
          isCoveredByRootPath(normalizeTemplateManifestPath(path), publishedPath)
        )
      ).toBe(true);
    }

    for (const path of SCAFFOLD_RUNTIME_SUPPORT_PATHS) {
      expect(removedPaths.has(normalizeTemplateManifestPath(path))).toBe(true);
      expect(
        publishedPaths.some((publishedPath) =>
          isCoveredByRootPath(normalizeTemplateManifestPath(path), publishedPath)
        )
      ).toBe(true);
    }
  });

  it("keeps doctor-required paths aligned with the template manifest", () => {
    const templateRoots = new Set(TEMPLATE_ROOT_PATHS.map(normalizeTemplateManifestPath));
    const generatedRuntime = new Set(
      GENERATED_APP_RUNTIME_SCRIPT_PATHS.map(normalizeTemplateManifestPath)
    );

    for (const path of DOCTOR_REQUIRED_GENERATED_APP_PATHS) {
      expect(templateRoots.has(normalizeTemplateManifestPath(path))).toBe(true);
    }

    for (const path of DOCTOR_REQUIRED_RUNTIME_PATHS) {
      expect(generatedRuntime.has(normalizeTemplateManifestPath(path))).toBe(true);
    }
  });
});
