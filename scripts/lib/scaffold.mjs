export {
  buildScaffoldPlan,
  buildScaffoldSummary,
  resolveSelectedFeatures,
  validateProjectName,
} from "./scaffold/planner.mjs";

export {
  applyCoreOnlyTransforms,
  applyFeatureSelection,
  rewriteIndexForCoreOnly,
} from "./scaffold/transforms/feature-selection.mjs";

export { rewriteScaffoldMetadata } from "./scaffold/transforms/metadata.mjs";

export { scaffoldStarter, writeCoreOnlyApp } from "./scaffold/orchestrator.mjs";
