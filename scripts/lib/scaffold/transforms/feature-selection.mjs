import { rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { EXAMPLE_FEATURE_KEYS } from "../../starter-catalog.mjs";
import {
  rewriteIndexForCoreOnly as rewriteIndexForCoreOnlyTransform,
  rewriteIndexForSelectedFeatures,
} from "./index-selection.mjs";
import {
  removeItemsExampleArtifacts,
  rewriteItemsDependentFiles,
} from "./items-selection.mjs";

function hasFeature(selectedFeatures, featureKey) {
  return selectedFeatures.includes(featureKey);
}

async function removeUnselectedFeaturePacks(targetDir, selectedFeatures) {
  for (const featureKey of EXAMPLE_FEATURE_KEYS) {
    if (hasFeature(selectedFeatures, featureKey)) continue;

    await rm(join(targetDir, "examples/feature-packs", featureKey), {
      recursive: true,
      force: true,
    });
  }
}

async function removeUnneededExampleSupport(targetDir, selectedFeatures) {
  if (!selectedFeatures.some((featureKey) => EXAMPLE_FEATURE_KEYS.includes(featureKey))) {
    await rm(join(targetDir, "examples"), { recursive: true, force: true });
    return;
  }

  if (!hasFeature(selectedFeatures, "kv") && !hasFeature(selectedFeatures, "upload")) {
    await rm(join(targetDir, "examples/lib"), { recursive: true, force: true });
  }
}

export async function applyFeatureSelection(targetDir, selectedFeatures) {
  await removeUnselectedFeaturePacks(targetDir, selectedFeatures);
  await removeUnneededExampleSupport(targetDir, selectedFeatures);
  await removeItemsExampleArtifacts(targetDir, selectedFeatures);

  await rewriteIndexForSelectedFeatures(join(targetDir, "src/index.ts"), selectedFeatures);
  await rewriteItemsDependentFiles(targetDir, basename(targetDir), selectedFeatures);
}

export async function rewriteIndexForCoreOnly(indexPath) {
  await rewriteIndexForCoreOnlyTransform(indexPath);
}

export async function applyCoreOnlyTransforms(targetDir) {
  await rm(join(targetDir, "examples"), { recursive: true, force: true });
  await rm(join(targetDir, "migrations/0010_example_items.sql"), { force: true });
  await rm(join(targetDir, "app/pages/HomePage.tsx"), { force: true });
  await rewriteIndexForCoreOnly(join(targetDir, "src/index.ts"));
  await rewriteItemsDependentFiles(targetDir, basename(targetDir), []);
}
