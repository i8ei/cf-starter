import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { materializeFeatureMigrations } from "./example-migrations.mjs";
import { TEMPLATE_OPTIONAL_PATHS } from "./template-manifest.mjs";
import { resolveTemplateSource } from "./template-source.mjs";
import { buildGeneratedAppTemplateSnapshot } from "./template-snapshot.mjs";

function uniqueSorted(paths) {
  return Array.from(new Set(paths)).sort();
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function isOptionalPath(relativePath, selectedOptionalPaths) {
  return selectedOptionalPaths.some(
    (optionalPath) => relativePath === optionalPath || relativePath.startsWith(`${optionalPath}/`)
  );
}

function isSelectedOptionalRoot(rootPath, selectedOptionalPaths) {
  return selectedOptionalPaths.some(
    (optionalPath) => optionalPath === rootPath || optionalPath.startsWith(`${rootPath}/`)
  );
}

async function hasSelectedOptionalRootSource(sourceDir, rootPath, selectedOptionalPaths) {
  const candidatePaths = selectedOptionalPaths.filter(
    (optionalPath) => optionalPath === rootPath || optionalPath.startsWith(`${rootPath}/`)
  );

  for (const relativePath of candidatePaths) {
    if (await pathExists(join(sourceDir, relativePath))) {
      return true;
    }
  }

  return false;
}

function isMaterializedMigrationPath(relativePath) {
  return relativePath.startsWith("migrations/");
}

const ALL_OPTIONAL_PATHS = Object.freeze(Object.values(TEMPLATE_OPTIONAL_PATHS).flat());

function isAnyOptionalPath(relativePath) {
  return ALL_OPTIONAL_PATHS.some(
    (optionalPath) => relativePath === optionalPath || relativePath.startsWith(`${optionalPath}/`)
  );
}

async function copyPath(sourceDir, targetDir, relativePath, { skipMissing = false } = {}) {
  const sourcePath = join(sourceDir, relativePath);
  if (skipMissing && !(await pathExists(sourcePath))) {
    return false;
  }
  const targetPath = join(targetDir, relativePath);
  await mkdir(dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true });
  return true;
}

async function copyCoreMigrations(sourceDir, targetDir, selectedOptionalPaths, { skipMissing = false } = {}) {
  const migrationsDir = join(sourceDir, "migrations");
  if (skipMissing && !(await pathExists(migrationsDir))) {
    return;
  }
  const entries = await readdir(migrationsDir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = join("migrations", entry.name);
    if (isAnyOptionalPath(relativePath) || isOptionalPath(relativePath, selectedOptionalPaths)) {
      continue;
    }
    await copyPath(sourceDir, targetDir, relativePath, { skipMissing });
  }
}

function buildTemplateRootCopyPaths(expectedTemplateRootPaths, selectedOptionalPaths) {
  return expectedTemplateRootPaths.filter(
    (relativePath) =>
      relativePath !== "examples" &&
      relativePath !== "migrations" &&
      !isOptionalPath(relativePath, selectedOptionalPaths)
  );
}

export function buildTemplateCandidatePlan(options = {}) {
  const snapshot = buildGeneratedAppTemplateSnapshot(options);
  const { expectedTemplateRootPaths, selectedOptionalPaths, generatedAppRuntimeScriptPaths } = snapshot;

  return {
    ...snapshot,
    templateRootCopyPaths: buildTemplateRootCopyPaths(expectedTemplateRootPaths, selectedOptionalPaths),
    selectedOptionalPaths: uniqueSorted(selectedOptionalPaths),
    generatedAppRuntimeScriptPaths: uniqueSorted(generatedAppRuntimeScriptPaths),
  };
}

export async function materializeTemplateCandidate({
  sourceDir,
  templateDir,
  targetDir,
  appName = basename(targetDir),
  coreOnly = false,
  include = [],
  exclude = [],
  includeGeneratedAppRuntimeScripts = true,
  allowPartialSourceTree,
} = {}) {
  const resolvedTemplateSource =
    templateDir === undefined && allowPartialSourceTree === undefined
      ? await resolveTemplateSource(sourceDir)
      : {
          templateDir: templateDir ?? sourceDir,
          allowPartialSourceTree: allowPartialSourceTree ?? false,
          sourceKind: (allowPartialSourceTree ?? false) ? "partial-source-tree" : "checked-in-template",
        };
  const {
    templateDir: resolvedTemplateDir,
    allowPartialSourceTree: allowPartialCompatibility,
    sourceKind,
  } = resolvedTemplateSource;
  const plan = buildTemplateCandidatePlan({
    appName,
    targetDir,
    coreOnly,
    include,
    exclude,
  });

  await mkdir(targetDir, { recursive: true });

  for (const relativePath of plan.templateRootCopyPaths) {
    await copyPath(resolvedTemplateDir, targetDir, relativePath, {
      skipMissing: allowPartialCompatibility,
    });
  }

  await copyCoreMigrations(resolvedTemplateDir, targetDir, plan.selectedOptionalPaths, {
    skipMissing: allowPartialCompatibility,
  });

  const shouldCreateExamplesRoot =
    isSelectedOptionalRoot("examples", plan.selectedOptionalPaths) &&
    (!allowPartialCompatibility ||
      (await hasSelectedOptionalRootSource(
        resolvedTemplateDir,
        "examples",
        plan.selectedOptionalPaths
      )));

  if (shouldCreateExamplesRoot) {
    await mkdir(join(targetDir, "examples"), { recursive: true });
  }

  for (const relativePath of plan.selectedOptionalPaths) {
    if (isMaterializedMigrationPath(relativePath)) {
      continue;
    }
    await copyPath(resolvedTemplateDir, targetDir, relativePath, {
      skipMissing: allowPartialCompatibility,
    });
  }

  await materializeFeatureMigrations({
    sourceDir: resolvedTemplateDir,
    targetDir,
    selectedFeatures: plan.selectedFeatures,
    skipExisting: true,
  });

  if (includeGeneratedAppRuntimeScripts) {
    for (const relativePath of plan.generatedAppRuntimeScriptPaths) {
      await copyPath(sourceDir, targetDir, relativePath, {
        skipMissing: allowPartialCompatibility,
      });
    }
  }

  return {
    ...plan,
    sourceKind,
    copiedPaths: uniqueSorted(
      [
        ...plan.templateRootCopyPaths,
        ...plan.selectedOptionalPaths,
        ...(includeGeneratedAppRuntimeScripts ? plan.generatedAppRuntimeScriptPaths : []),
        "migrations",
      ].filter(Boolean)
    ),
    relativeTargetDir: relative(process.cwd(), targetDir) || ".",
  };
}
