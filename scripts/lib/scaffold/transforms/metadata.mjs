import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { CORE_REQUIRED_BINDINGS } from "../../starter-catalog.mjs";
import { toDisplayName } from "../renderers/app-template.mjs";
import { pathExists, rewriteTextFile } from "./file-ops.mjs";
import { rewriteGeneratedAppShell } from "./app-metadata.mjs";
import { rewriteGeneratedAppPackageJson } from "./package-metadata.mjs";
import { rewriteGeneratedAppReadme } from "./readme-metadata.mjs";
import { rewriteGeneratedAppWrangler } from "./wrangler-metadata.mjs";

export async function rewriteScaffoldMetadata(
  targetDir,
  appName,
  { coreOnly = false, selectedFeatures = [], requiredBindings = CORE_REQUIRED_BINDINGS } = {}
) {
  const displayName = toDisplayName(appName);

  const packageJsonPath = join(targetDir, "package.json");
  if (await pathExists(packageJsonPath)) {
    await rewriteTextFile(packageJsonPath, (source) =>
      rewriteGeneratedAppPackageJson(source, appName, displayName)
    );
  }

  const wranglerPath = join(targetDir, "wrangler.jsonc");
  if (await pathExists(wranglerPath)) {
    await rewriteTextFile(wranglerPath, (source) =>
      rewriteGeneratedAppWrangler(source, appName, requiredBindings)
    );
  }

  const readmePath = join(targetDir, "README.md");
  if (await pathExists(readmePath)) {
    await writeFile(
      readmePath,
      rewriteGeneratedAppReadme({
        appName,
        coreOnly,
        selectedFeatures,
        requiredBindings,
      })
    );
  }

  const appPath = join(targetDir, "app/App.tsx");
  if (await pathExists(appPath)) {
    await rewriteTextFile(appPath, (source) => rewriteGeneratedAppShell(source, appName, displayName));
  }
}
