import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { materializeTemplateCandidate } from "./template-candidate.mjs";

export async function materializeTemplateDirectory({
  sourceDir,
  targetDir,
  appName = "cf-starter-template",
} = {}) {
  return materializeTemplateCandidate({
    sourceDir,
    targetDir,
    appName,
    includeGeneratedAppRuntimeScripts: false,
  });
}

async function collectRelativeFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectRelativeFiles(rootDir, entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(relative(rootDir, entryPath));
    }
  }

  return files;
}

function formatTemplateDirectoryDiff(diff) {
  const sourceLabel =
    diff.sourceKind === "checked-in-template" ? "checked-in template source" : "partial source tree";
  const lines = [
    `Template directory does not match the materialized ${sourceLabel} output (${diff.relativeTemplateDir}).`,
  ];

  if (diff.missingFiles.length > 0) {
    lines.push(`Missing files (${diff.missingFiles.length}):`);
    lines.push(...diff.missingFiles.map((filePath) => `  - ${filePath}`));
  }

  if (diff.unexpectedFiles.length > 0) {
    lines.push(`Unexpected files (${diff.unexpectedFiles.length}):`);
    lines.push(...diff.unexpectedFiles.map((filePath) => `  - ${filePath}`));
  }

  if (diff.changedFiles.length > 0) {
    lines.push(`Changed files (${diff.changedFiles.length}):`);
    lines.push(...diff.changedFiles.map((filePath) => `  - ${filePath}`));
  }

  lines.push("Run `npm run template:sync` to regenerate template/.");
  return lines.join("\n");
}

export async function buildTemplateDirectoryDiff({
  sourceDir,
  templateDir,
  appName = "cf-starter-template",
} = {}) {
  const expectedDir = await mkdtemp(join(tmpdir(), "cf-starter-template-check-"));

  try {
    const summary = await materializeTemplateDirectory({
      sourceDir,
      targetDir: expectedDir,
      appName,
    });
    const expectedFiles = await collectRelativeFiles(expectedDir);
    const actualFiles = await collectRelativeFiles(templateDir);
    const expectedSet = new Set(expectedFiles);
    const actualSet = new Set(actualFiles);
    const missingFiles = expectedFiles.filter((filePath) => !actualSet.has(filePath));
    const unexpectedFiles = actualFiles.filter((filePath) => !expectedSet.has(filePath));
    const changedFiles = [];

    for (const filePath of expectedFiles) {
      if (!actualSet.has(filePath)) {
        continue;
      }

      const [expectedContent, actualContent] = await Promise.all([
        readFile(join(expectedDir, filePath)),
        readFile(join(templateDir, filePath)),
      ]);

      if (!expectedContent.equals(actualContent)) {
        changedFiles.push(filePath);
      }
    }

    return {
      ...summary,
      expectedFiles,
      actualFiles,
      missingFiles,
      unexpectedFiles,
      changedFiles,
      matches: missingFiles.length === 0 && unexpectedFiles.length === 0 && changedFiles.length === 0,
      relativeTemplateDir: relative(process.cwd(), templateDir) || ".",
    };
  } finally {
    await rm(expectedDir, { recursive: true, force: true });
  }
}

export async function assertTemplateDirectoryMatches(options = {}) {
  const diff = await buildTemplateDirectoryDiff(options);

  if (!diff.matches) {
    throw new Error(formatTemplateDirectoryDiff(diff));
  }

  return diff;
}
