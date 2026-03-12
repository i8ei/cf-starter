import { access, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { takeFlag, takeListOption, takeOption } from "../lib/cli-args.mjs";

export function takeResolvedPathOption(args, name, { defaultValue = null } = {}) {
  const value = takeOption(args, name);
  if (value == null) {
    return defaultValue == null ? null : resolve(defaultValue);
  }
  return resolve(value);
}

export function takeRequiredResolvedPathOption(args, name) {
  const value = takeResolvedPathOption(args, name);
  if (value == null) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function takeTemplateContextArgs(
  args,
  { defaultAppName, defaultSourceDir = process.cwd() } = {}
) {
  return {
    sourceDir: takeResolvedPathOption(args, "--source-dir", { defaultValue: defaultSourceDir }),
    appName: takeOption(args, "--app-name") ?? defaultAppName,
  };
}

export function takeTemplateFeatureSelectionArgs(
  args,
  { defaultAppName = "regional-ops", defaultSourceDir = process.cwd() } = {}
) {
  return {
    ...takeTemplateContextArgs(args, { defaultAppName, defaultSourceDir }),
    coreOnly: takeFlag(args, "--core-only"),
    include: takeListOption(args, "--include"),
    exclude: takeListOption(args, "--exclude"),
  };
}

export function takeTemplateReportFlags(args) {
  return {
    compact: takeFlag(args, "--compact"),
    verbose: takeFlag(args, "--verbose"),
  };
}

async function pathExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function removeTargetDirIfForced({ force, targetDir }) {
  if (force && (await pathExists(targetDir))) {
    await rm(targetDir, { recursive: true, force: true });
  }
}

export function takeTemplateMaterializeCliArgs(args) {
  const { sourceDir, appName, coreOnly, include, exclude } = takeTemplateFeatureSelectionArgs(args);
  const { verbose } = takeTemplateReportFlags(args);
  const targetDir = takeRequiredResolvedPathOption(args, "--target-dir");

  return {
    sourceDir,
    targetDir,
    appName,
    coreOnly,
    include,
    exclude,
    verbose,
  };
}

export function takeTemplateSnapshotCliArgs(args) {
  const { sourceDir, appName, coreOnly, include, exclude } = takeTemplateFeatureSelectionArgs(args);
  const { compact, verbose } = takeTemplateReportFlags(args);
  const outputPath = takeResolvedPathOption(args, "--write");

  return {
    sourceDir,
    appName,
    coreOnly,
    include,
    exclude,
    compact,
    verbose,
    outputPath,
  };
}

export function takeTemplateCheckCliArgs(args) {
  const { sourceDir, appName } = takeTemplateContextArgs(args, {
    defaultAppName: "cf-starter-template",
  });
  const templateDir = takeResolvedPathOption(args, "--template-dir", { defaultValue: "template" });
  const { compact, verbose } = takeTemplateReportFlags(args);

  return {
    sourceDir,
    templateDir,
    appName,
    compact,
    verbose,
  };
}

export function takeTemplateSyncCliArgs(args) {
  const { sourceDir, appName } = takeTemplateContextArgs(args, {
    defaultAppName: "cf-starter-template",
  });
  const targetDir = takeResolvedPathOption(args, "--target-dir", { defaultValue: "template" });
  const { verbose } = takeTemplateReportFlags(args);
  const force = takeFlag(args, "--force");

  return {
    sourceDir,
    targetDir,
    appName,
    verbose,
    force,
    prepare() {
      return removeTargetDirIfForced({ force, targetDir });
    },
  };
}
