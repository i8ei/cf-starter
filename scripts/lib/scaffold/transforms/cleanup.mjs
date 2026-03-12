import { rm } from "node:fs/promises";
import { join } from "node:path";
import { GENERATED_APP_REMOVED_PATHS } from "../../starter-catalog.mjs";
import { renderGeneratedAppCiWorkflow as renderWorkflow } from "../renderers/workflow.mjs";
import { pathExists, rewriteTextFile } from "./file-ops.mjs";
import { stripRemainingScaffoldMarkers } from "./scaffold-markers.mjs";

export async function removeStarterOnlyGeneratedFiles(targetDir) {
  for (const relativePath of GENERATED_APP_REMOVED_PATHS) {
    await rm(join(targetDir, relativePath), { recursive: true, force: true });
  }
}

export async function rewriteGeneratedAppCiWorkflow(workflowPath) {
  if (!(await pathExists(workflowPath))) {
    return;
  }

  await rewriteTextFile(workflowPath, renderWorkflow);
}

const SCAFFOLD_MARKER_FILES = [
  "src/index.ts",
  "app/App.tsx",
  "src/db/schema.ts",
  "app/pages/HomePage.tsx",
];

export async function stripGeneratedAppScaffoldMarkers(targetDir) {
  await Promise.all(
    SCAFFOLD_MARKER_FILES.map(async (relativePath) => {
      const filePath = join(targetDir, relativePath);
      if (!(await pathExists(filePath))) {
        return;
      }
      await rewriteTextFile(filePath, stripRemainingScaffoldMarkers);
    })
  );
}
