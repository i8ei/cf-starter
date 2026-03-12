import { basename } from "node:path";
import {
  CORE_BINDING_REASONS,
  CORE_REQUIRED_BINDINGS,
  EXAMPLE_FEATURE_KEYS,
  GENERATED_APP_REMOVED_PATHS,
  GENERATED_APP_REWRITTEN_PATHS,
  REMOVABLE_BINDING_REASONS,
} from "../starter-catalog.mjs";
import { starterManifest } from "../starter-manifest.mjs";

const PROJECT_NAME_PATTERN = /^[a-z][a-z0-9-]{0,62}$/;

export function buildValidationError(message) {
  const error = new Error(message);
  error.name = "ScaffoldValidationError";
  return error;
}

export function validateProjectName(appName) {
  if (!appName || typeof appName !== "string") {
    throw buildValidationError("Project name is required.");
  }

  if (!PROJECT_NAME_PATTERN.test(appName)) {
    throw buildValidationError(
      `Invalid project name "${appName}". Use 1-63 chars, start with a lowercase letter, and use only lowercase letters, numbers, and hyphens.`
    );
  }

  return appName;
}

function validateFeatureList(featureList, optionName) {
  const unknown = featureList.filter((feature) => !EXAMPLE_FEATURE_KEYS.includes(feature));
  if (unknown.length > 0) {
    throw buildValidationError(
      `Unknown feature in ${optionName}: ${unknown.join(", ")}. Available features: ${EXAMPLE_FEATURE_KEYS.join(", ")}.`
    );
  }
}

export function resolveSelectedFeatures({
  coreOnly = false,
  include = [],
  exclude = [],
} = {}) {
  if (coreOnly) return [];

  const includeSet = new Set(include.filter(Boolean));
  const excludeSet = new Set(exclude.filter(Boolean));
  const base = includeSet.size > 0 ? EXAMPLE_FEATURE_KEYS.filter((key) => includeSet.has(key)) : [...EXAMPLE_FEATURE_KEYS];
  return base.filter((key) => !excludeSet.has(key));
}

function getSelectedFeatureManifests(selectedFeatures) {
  return starterManifest.exampleFeatures.filter((feature) =>
    selectedFeatures.includes(feature.key)
  );
}

function buildProfile({ coreOnly, selectedFeatures }) {
  if (coreOnly) return "core-only";
  if (selectedFeatures.length === 0) return "no-examples-selected";
  return "optional-examples";
}

export function buildScaffoldSummary({ appName, coreOnly = false, selectedFeatures = [] }) {
  const featureManifests = getSelectedFeatureManifests(selectedFeatures);
  const requiredBindings = Array.from(
    new Set([
      ...CORE_REQUIRED_BINDINGS,
      ...featureManifests.flatMap((feature) => feature.requiredBindings),
    ])
  );

  const nextSteps = [
    "Run npm install",
    "Run npm run db:migrate",
    "Optionally run npm run seed:demo for a local demo user",
    "Run npm run doctor",
    "Set real d1 database_id and queue name in wrangler.jsonc",
  ];

  if (requiredBindings.includes("KV")) {
    nextSteps.push("Create or wire the KV namespace, then set the KV binding in wrangler.jsonc");
  }

  if (requiredBindings.includes("BUCKET")) {
    nextSteps.push("Create or wire the R2 bucket, then set the BUCKET binding in wrangler.jsonc");
  }

  if (coreOnly) {
    nextSteps.push("Add your first domain feature under src/routes or src/features");
  } else if (selectedFeatures.length > 0) {
    nextSteps.push(`Decide whether to keep or replace: ${selectedFeatures.join(", ")}`);
  } else {
    nextSteps.push("Add the example features you need or replace them with domain features");
  }

  return {
    appName,
    mode: coreOnly ? "core-only" : "starter",
    profile: buildProfile({ coreOnly, selectedFeatures }),
    selectedFeatures,
    requiredBindings,
    nextSteps,
  };
}

function buildScaffoldFileChanges({ coreOnly, selectedFeatures }) {
  const filesRemoved = [...GENERATED_APP_REMOVED_PATHS];
  const filesRewritten = [
    "package.json",
    "wrangler.jsonc",
    "README.md",
    "app/App.tsx",
    ...GENERATED_APP_REWRITTEN_PATHS,
  ];

  if (coreOnly) {
    filesRemoved.push("examples/");
    filesRewritten.push("src/index.ts", "src/db/schema.ts", "app/pages/HomePage.tsx");
    return {
      filesRemoved,
      filesRewritten,
    };
  }

  for (const featureKey of EXAMPLE_FEATURE_KEYS) {
    if (selectedFeatures.includes(featureKey)) continue;
    filesRemoved.push(`examples/feature-packs/${featureKey}/`);
  }

  if (!selectedFeatures.includes("kv") && !selectedFeatures.includes("upload")) {
    filesRemoved.push("examples/lib/");
  }

  if (filesRemoved.length > 0) {
    filesRewritten.push("src/index.ts");
  }
  if (!selectedFeatures.includes("items")) {
    filesRewritten.push("app/App.tsx", "src/db/schema.ts", "app/pages/HomePage.tsx");
  }

  return {
    filesRemoved,
    filesRewritten: Array.from(new Set(filesRewritten)),
  };
}

function buildBindingChanges(requiredBindings) {
  const removableBindings = ["KV", "BUCKET"];
  return removableBindings.filter((binding) => !requiredBindings.includes(binding));
}

function buildRemovedBindingReasons(bindingsRemoved) {
  return Object.fromEntries(
    bindingsRemoved.map((binding) => [binding, REMOVABLE_BINDING_REASONS[binding]])
  );
}

function buildCoreBindingsKept(requiredBindings) {
  return CORE_REQUIRED_BINDINGS.filter((binding) => requiredBindings.includes(binding));
}

function buildCoreBindingReasons(coreBindingsKept) {
  return Object.fromEntries(
    coreBindingsKept.map((binding) => [binding, CORE_BINDING_REASONS[binding]])
  );
}

function buildScaffoldWarnings({ coreOnly, selectedFeatures, requiredBindings }) {
  const warnings = [];

  if (!selectedFeatures.includes("upload") && requiredBindings.includes("JOBS")) {
    warnings.push("JOBS binding remains required for invite, password reset, email verification, and welcome mail flows.");
  }
  if (coreOnly) {
    warnings.push("Core-only still keeps organization, auth, queue, and scheduled maintenance features.");
  }
  if (!coreOnly && selectedFeatures.length === 0) {
    warnings.push("No example features were selected. Consider using --core-only if you want a smaller starting point.");
  }
  if (selectedFeatures.includes("kv") && !selectedFeatures.includes("items")) {
    warnings.push("The kv example has no dedicated frontend hooks or schema; it is backend-only sample surface.");
  }

  return warnings;
}

export function buildScaffoldPlan({
  targetDir,
  appName = basename(targetDir),
  coreOnly = false,
  include = [],
  exclude = [],
} = {}) {
  validateProjectName(appName);
  validateFeatureList(include, "--include");
  validateFeatureList(exclude, "--exclude");

  const selectedFeatures = resolveSelectedFeatures({ coreOnly, include, exclude });
  const summary = buildScaffoldSummary({ appName, coreOnly, selectedFeatures });
  const removedFeatures = EXAMPLE_FEATURE_KEYS.filter(
    (featureKey) => !selectedFeatures.includes(featureKey)
  );
  const { filesRemoved, filesRewritten } = buildScaffoldFileChanges({
    coreOnly,
    selectedFeatures,
  });
  const bindingsRemoved = buildBindingChanges(summary.requiredBindings);
  const bindingRemovalReasons = buildRemovedBindingReasons(bindingsRemoved);
  const coreBindingsKept = buildCoreBindingsKept(summary.requiredBindings);
  const coreBindingReasons = buildCoreBindingReasons(coreBindingsKept);
  const warnings = buildScaffoldWarnings({
    coreOnly,
    selectedFeatures,
    requiredBindings: summary.requiredBindings,
  });
  const transforms = [];

  if (coreOnly) {
    transforms.push("Remove all example feature packs from examples/");
    transforms.push("Rewrite src/index.ts to keep only core routes");
    transforms.push("Replace app/App.tsx with the core-only starter UI");
  } else if (removedFeatures.length > 0) {
    transforms.push(`Remove example features: ${removedFeatures.join(", ")}`);
    transforms.push("Rewrite src/index.ts to mount only selected example routes");
    if (!selectedFeatures.includes("items")) {
      transforms.push("Remove the example items panel from app/App.tsx");
    }
  }

  transforms.push("Rewrite package.json, wrangler.jsonc, README.md, and app/App.tsx for the generated app name");
  transforms.push("Tailor README.md to selected features and required Cloudflare bindings");
  transforms.push("Remove starter-only scripts, tests, and docs from the generated app");
  transforms.push("Rewrite .github/workflows/ci.yml to the generated app baseline");

  return {
    targetDir,
    ...summary,
    removedFeatures,
    coreBindingsKept,
    coreBindingReasons,
    bindingsRemoved,
    bindingRemovalReasons,
    filesRemoved,
    filesRewritten,
    warnings,
    transforms,
  };
}
