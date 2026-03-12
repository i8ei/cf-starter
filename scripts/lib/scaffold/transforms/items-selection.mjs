import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildGenericHomePage } from "../renderers/app-template.mjs";
import { pathExists, rewriteTextFileIfExists } from "./file-ops.mjs";
import { removeScaffoldBlock } from "./scaffold-markers.mjs";

const ITEMS_APP_MARKER_BLOCKS = [
  { name: "items-import" },
  { name: "items-state" },
  { name: "items-hooks" },
  { name: "items-panel", jsx: true },
];

function hasFeature(selectedFeatures, featureKey) {
  return selectedFeatures.includes(featureKey);
}

function stripItemsFeatureFromApp(source) {
  return ITEMS_APP_MARKER_BLOCKS.reduce(
    (current, block) => removeScaffoldBlock(current, block),
    source
  );
}

function stripItemsFeatureFromSchema(source) {
  return removeScaffoldBlock(source, { name: "items-schema" });
}

export async function rewriteItemsDependentFiles(targetDir, appName, selectedFeatures) {
  if (hasFeature(selectedFeatures, "items")) {
    return;
  }

  await rewriteTextFileIfExists(join(targetDir, "app/App.tsx"), stripItemsFeatureFromApp);
  await rewriteTextFileIfExists(join(targetDir, "src/db/schema.ts"), stripItemsFeatureFromSchema);

  const homePagePath = join(targetDir, "app/pages/HomePage.tsx");
  if (await pathExists(homePagePath)) {
    await writeFile(homePagePath, buildGenericHomePage(appName));
  }
}

export async function removeItemsExampleArtifacts(targetDir, selectedFeatures) {
  if (!hasFeature(selectedFeatures, "items")) {
    await rm(join(targetDir, "migrations/0010_example_items.sql"), { force: true });
  }
}
