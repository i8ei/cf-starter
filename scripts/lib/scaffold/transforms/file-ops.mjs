import { readFile, stat, writeFile } from "node:fs/promises";

export async function pathExists(filePath) {
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

export async function rewriteTextFile(filePath, updater) {
  const source = await readFile(filePath, "utf8");
  await writeFile(filePath, updater(source));
}

export async function rewriteTextFileIfExists(filePath, updater) {
  if (!(await pathExists(filePath))) {
    return;
  }

  await rewriteTextFile(filePath, updater);
}
