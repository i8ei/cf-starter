import { stat } from "node:fs/promises";
import { join } from "node:path";

async function pathExists(filePath) {
  try {
    return await stat(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function resolveTemplateSource(sourceDir) {
  const defaultTemplateDir = join(sourceDir, "template");
  const templateDirInfo = await pathExists(defaultTemplateDir);

  if (!templateDirInfo?.isDirectory()) {
    return {
      templateDir: sourceDir,
      allowPartialSourceTree: true,
      sourceKind: "partial-source-tree",
    };
  }

  const templatePackageInfo = await pathExists(join(defaultTemplateDir, "package.json"));
  if (!templatePackageInfo?.isFile()) {
    return {
      templateDir: sourceDir,
      allowPartialSourceTree: true,
      sourceKind: "partial-source-tree",
    };
  }

  return {
    templateDir: defaultTemplateDir,
    allowPartialSourceTree: false,
    sourceKind: "checked-in-template",
  };
}
