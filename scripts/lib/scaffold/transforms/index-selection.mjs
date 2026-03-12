import { readFile, writeFile } from "node:fs/promises";
import { EXAMPLE_FEATURE_KEYS } from "../../starter-catalog.mjs";
import { removeScaffoldBlock } from "./scaffold-markers.mjs";

const INDEX_FEATURE_PATTERNS = {
  items: [
    'import items from "../examples/feature-packs/items/server/routes";',
    '.route("/api/items", items)',
  ],
  kv: [
    'import kv from "../examples/feature-packs/kv/server/routes";',
    '.route("/api/kv", kv)',
  ],
  upload: [
    'import upload from "../examples/feature-packs/upload/server/routes";',
    '.route("/api/upload", upload)',
  ],
};

const INDEX_MARKER_SECTIONS = ["feature-import", "feature-route"];

function hasFeature(selectedFeatures, featureKey) {
  return selectedFeatures.includes(featureKey);
}

function stripLegacyFeatureFromIndex(source, featureKey) {
  return source
    .split("\n")
    .filter((line) => !INDEX_FEATURE_PATTERNS[featureKey].some((pattern) => line.includes(pattern)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function stripMarkerBasedFeatureFromIndex(source, featureKey) {
  return INDEX_MARKER_SECTIONS.reduce(
    (current, section) => removeScaffoldBlock(current, { name: section, featureKey }),
    source
  );
}

function stripFeatureFromIndexSource(source, featureKey) {
  const markerUpdated = stripMarkerBasedFeatureFromIndex(source, featureKey);

  if (markerUpdated !== source) {
    return markerUpdated;
  }

  return stripLegacyFeatureFromIndex(source, featureKey);
}

export async function rewriteIndexForSelectedFeatures(indexPath, selectedFeatures) {
  const source = await readFile(indexPath, "utf8");
  const updated = EXAMPLE_FEATURE_KEYS.reduce((current, featureKey) => {
    if (hasFeature(selectedFeatures, featureKey)) return current;
    return stripFeatureFromIndexSource(current, featureKey);
  }, source);

  await writeFile(indexPath, updated);
}

export async function rewriteIndexForCoreOnly(indexPath) {
  const source = await readFile(indexPath, "utf8");
  const updated = EXAMPLE_FEATURE_KEYS.reduce(
    (current, featureKey) => stripFeatureFromIndexSource(current, featureKey),
    source
  );
  await writeFile(indexPath, updated);
}
