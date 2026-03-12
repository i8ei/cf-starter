import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { materializeFeatureMigrations } from "../example-migrations.mjs";
import { COPY_EXCLUDES } from "../starter-catalog.mjs";
import { buildValidationError, buildScaffoldPlan } from "./planner.mjs";
import { buildCoreOnlyAppTemplate } from "./renderers/app-template.mjs";
import {
  applyCoreOnlyTransforms,
  applyFeatureSelection,
} from "./transforms/feature-selection.mjs";
import {
  removeStarterOnlyGeneratedFiles,
  rewriteGeneratedAppCiWorkflow,
  stripGeneratedAppScaffoldMarkers,
} from "./transforms/cleanup.mjs";
import { rewriteScaffoldMetadata } from "./transforms/metadata.mjs";

function shouldCopy(sourcePath) {
  const parts = sourcePath.split("/").filter(Boolean);
  return !parts.some((part) => COPY_EXCLUDES.includes(part));
}

async function ensureTargetReady(targetDir, { force }) {
  try {
    const info = await stat(targetDir);
    if (!info.isDirectory()) {
      throw buildValidationError(`Target exists and is not a directory: ${targetDir}`);
    }
    if (force) {
      await rm(targetDir, { recursive: true, force: true });
      await mkdir(targetDir, { recursive: true });
      return { createdByScaffold: true };
    }
    throw buildValidationError(
      `Refusing to overwrite existing directory: ${targetDir}. Use a new target path.`
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      await mkdir(targetDir, { recursive: true });
      return { createdByScaffold: true };
    }
    throw error;
  }
}

export async function writeCoreOnlyApp(targetDir, appName) {
  await writeFile(join(targetDir, "app/App.tsx"), buildCoreOnlyAppTemplate(appName));
}

export async function scaffoldStarter({
  sourceDir,
  targetDir,
  appName = basename(targetDir),
  coreOnly = false,
  include = [],
  exclude = [],
  force = false,
}) {
  const { createdByScaffold } = await ensureTargetReady(targetDir, { force });

  try {
    await cp(sourceDir, targetDir, {
      recursive: true,
      filter: (sourcePath) => shouldCopy(sourcePath.replace(sourceDir, "")),
    });

    const plan = buildScaffoldPlan({ targetDir, appName, coreOnly, include, exclude });
    const { selectedFeatures } = plan;

    if (coreOnly) {
      await applyCoreOnlyTransforms(targetDir);
      await writeCoreOnlyApp(targetDir, appName);
    } else {
      await applyFeatureSelection(targetDir, selectedFeatures);
      await materializeFeatureMigrations({
        sourceDir: targetDir,
        targetDir,
        selectedFeatures,
      });
    }

    await stripGeneratedAppScaffoldMarkers(targetDir);
    await removeStarterOnlyGeneratedFiles(targetDir);
    await rewriteScaffoldMetadata(targetDir, appName, plan);
    await rewriteGeneratedAppCiWorkflow(join(targetDir, ".github/workflows/ci.yml"));

    return {
      ...plan,
    };
  } catch (error) {
    if (createdByScaffold) {
      await rm(targetDir, { recursive: true, force: true });
    }
    throw error;
  }
}
