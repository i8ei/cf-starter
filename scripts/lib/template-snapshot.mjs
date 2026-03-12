import { basename } from "node:path";
import { buildScaffoldPlan } from "./scaffold/planner.mjs";
import { resolveTemplateSource } from "./template-source.mjs";
import {
  GENERATED_APP_RUNTIME_SCRIPT_PATHS,
  SCAFFOLD_RUNTIME_SUPPORT_PATHS,
  TEMPLATE_OPTIONAL_PATHS,
  TEMPLATE_ROOT_PATHS,
  normalizeTemplateManifestPath,
} from "./template-manifest.mjs";

function uniqueSorted(paths) {
  return Array.from(new Set(paths.map(normalizeTemplateManifestPath))).sort();
}

function buildSelectedOptionalPaths(selectedFeatures) {
  return uniqueSorted(
    selectedFeatures.flatMap((featureKey) => TEMPLATE_OPTIONAL_PATHS[featureKey] ?? [])
  );
}

function buildExpectedTemplateRootPaths(selectedFeatures) {
  return uniqueSorted(
    TEMPLATE_ROOT_PATHS.filter((filePath) => filePath !== "examples" || selectedFeatures.length > 0)
  );
}

export function buildGeneratedAppTemplateSnapshot({
  appName = "regional-ops",
  targetDir = appName,
  coreOnly = false,
  include = [],
  exclude = [],
} = {}) {
  const resolvedAppName = appName || basename(targetDir);
  const plan = buildScaffoldPlan({
    targetDir,
    appName: resolvedAppName,
    coreOnly,
    include,
    exclude,
  });

  return {
    appName: resolvedAppName,
    profile: plan.profile,
    selectedFeatures: plan.selectedFeatures,
    requiredBindings: plan.requiredBindings,
    expectedTemplateRootPaths: buildExpectedTemplateRootPaths(plan.selectedFeatures),
    generatedAppRuntimeScriptPaths: uniqueSorted(GENERATED_APP_RUNTIME_SCRIPT_PATHS),
    selectedOptionalPaths: buildSelectedOptionalPaths(plan.selectedFeatures),
    scaffoldRuntimeSupportPaths: uniqueSorted(SCAFFOLD_RUNTIME_SUPPORT_PATHS),
    filesRemoved: uniqueSorted(plan.filesRemoved),
    filesRewritten: uniqueSorted(plan.filesRewritten),
  };
}

export async function buildGeneratedAppTemplateSnapshotReport({
  sourceDir = process.cwd(),
  ...options
} = {}) {
  const snapshot = buildGeneratedAppTemplateSnapshot(options);
  const { sourceKind } = await resolveTemplateSource(sourceDir);

  return {
    ...snapshot,
    sourceKind,
  };
}
