import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNoUnknownArgs,
  takeFlag,
  takeListOption,
  takeOption,
} from "../lib/cli-args.mjs";
import { buildScaffoldPlan, scaffoldStarter } from "../lib/scaffold.mjs";

function warnDeprecatedModeField(writer = console.error) {
  writer('[deprecated] JSON field "mode" remains for compatibility. Prefer "profile" and "selectedFeatures".');
}

function buildScaffoldModeLabel(planOnly) {
  return planOnly ? "Scaffold plan for" : "Scaffolded";
}

function buildScaffoldFeatureProfile(result) {
  return result.profile === "optional-examples"
    ? `optional examples: ${result.selectedFeatures.join(", ")}`
    : result.profile;
}

function buildScaffoldSummaryLines(result, { modeLabel, concise = false }) {
  const lines = [
    `${modeLabel} ${result.appName}`,
    `Target: ${result.targetDir}`,
    `Feature profile: ${buildScaffoldFeatureProfile(result)}`,
    `Required bindings: ${result.requiredBindings.join(", ")}`,
  ];

  if (concise) {
    lines.push(`Next steps: ${result.nextSteps.join(" | ")}`);
    return lines;
  }

  lines.push(`Selected features: ${result.selectedFeatures.length > 0 ? result.selectedFeatures.join(", ") : "none"}`);
  lines.push(`Core bindings kept: ${result.coreBindingsKept.join(", ")}`);
  if (result.coreBindingsKept.length > 0) {
    lines.push("Core binding reasons:");
    for (const binding of result.coreBindingsKept) {
      lines.push(`- ${binding}: ${result.coreBindingReasons[binding]}`);
    }
  }
  if (result.bindingsRemoved.length > 0) {
    lines.push(`Bindings removed: ${result.bindingsRemoved.join(", ")}`);
    lines.push("Binding removal reasons:");
    for (const binding of result.bindingsRemoved) {
      lines.push(`- ${binding}: ${result.bindingRemovalReasons[binding]}`);
    }
  }
  if (result.removedFeatures.length > 0) {
    lines.push(`Removed features: ${result.removedFeatures.join(", ")}`);
  }
  if (result.filesRemoved.length > 0) {
    lines.push(`Files removed: ${result.filesRemoved.join(", ")}`);
  }
  lines.push(`Files rewritten: ${result.filesRewritten.join(", ")}`);
  if (result.warnings.length > 0) {
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push("Transforms:");
  for (const transform of result.transforms) {
    lines.push(`- ${transform}`);
  }
  lines.push("Next steps:");
  for (const step of result.nextSteps) {
    lines.push(`- ${step}`);
  }
  return lines;
}

function printScaffoldSummary(result, { modeLabel, writer = console.log, concise = false }) {
  for (const line of buildScaffoldSummaryLines(result, { modeLabel, concise })) {
    writer(line);
  }
}

function createScaffoldFailureHandler({ usage, writer = console.error } = {}) {
  return function fail(message, { includeUsage = false } = {}) {
    writer(message);
    if (includeUsage && usage) {
      writer(usage);
    }
    process.exit(1);
  };
}

function parseScaffoldAppCliArgs({ argv, sourceDir, fail }) {
  const args = [...argv];
  const coreOnly = takeFlag(args, "--core-only");
  const force = takeFlag(args, "--force");
  const asJson = takeFlag(args, "--json");
  const planOnly = takeFlag(args, "--plan");

  let targetDirOption;
  try {
    targetDirOption = takeOption(args, "--target");
  } catch (error) {
    fail(error instanceof Error ? error.message : "Invalid --target option.", { includeUsage: true });
  }
  if (!targetDirOption) {
    fail("Missing required --target option.", { includeUsage: true });
  }

  const resolvedTargetDir = resolve(process.cwd(), targetDirOption);
  const sourceDirOption = takeOption(args, "--source-dir");
  const resolvedSourceDir = sourceDirOption ? resolve(process.cwd(), sourceDirOption) : sourceDir;
  const appName = takeOption(args, "--app-name") ?? undefined;
  const include = takeListOption(args, "--include");
  const exclude = takeListOption(args, "--exclude");
  const jsonOutOption = takeOption(args, "--json-out");
  const planOutOption = takeOption(args, "--plan-out");
  const jsonOutPath = jsonOutOption ? resolve(process.cwd(), jsonOutOption) : undefined;
  const planOutPath = planOutOption ? resolve(process.cwd(), planOutOption) : undefined;

  if (planOutPath && !planOnly) {
    fail("--plan-out can only be used together with --plan.");
  }

  if (takeFlag(args, "--repo-copy-layout")) {
    fail("--repo-copy-layout is no longer supported.");
  }

  try {
    assertNoUnknownArgs(args);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Unknown scaffold arguments.", { includeUsage: true });
  }

  return {
    resolvedSourceDir,
    force,
    asJson,
    planOnly,
    jsonOutPath,
    planOutPath,
    conciseSummary: Boolean(jsonOutPath || planOutPath),
    options: {
      targetDir: resolvedTargetDir,
      appName,
      coreOnly,
      include: include.length > 0 ? include : undefined,
      exclude: exclude.length > 0 ? exclude : undefined,
    },
  };
}

async function runScaffoldApp(parsedArgs) {
  return parsedArgs.planOnly
    ? buildScaffoldPlan(parsedArgs.options)
    : scaffoldStarter({
        sourceDir: parsedArgs.resolvedSourceDir,
        ...parsedArgs.options,
        force: parsedArgs.force,
      });
}

async function emitScaffoldAppResult(result, parsedArgs) {
  const { asJson, planOnly, jsonOutPath, planOutPath, conciseSummary } = parsedArgs;
  const modeLabel = buildScaffoldModeLabel(planOnly);

  if (asJson || jsonOutPath || planOutPath) {
    warnDeprecatedModeField();
  }

  if (asJson) {
    printScaffoldSummary(result, {
      modeLabel,
      writer: (line) => console.error(line),
      concise: conciseSummary,
    });
    console.log(JSON.stringify(result, null, 2));
  } else {
    printScaffoldSummary(result, { modeLabel, concise: conciseSummary });
  }

  if (jsonOutPath) {
    await writeFile(jsonOutPath, `${JSON.stringify(result, null, 2)}\n`);
  }

  if (planOutPath) {
    await writeFile(planOutPath, `${JSON.stringify(result, null, 2)}\n`);
  }
}

export async function runScaffoldAppCli({
  argv = process.argv.slice(2),
  sourceDir,
  usage,
  deprecationNotice,
} = {}) {
  if (deprecationNotice) {
    deprecationNotice();
  }

  const fail = createScaffoldFailureHandler({ usage });
  const parsedArgs = parseScaffoldAppCliArgs({ argv, sourceDir, fail });

  try {
    const result = await runScaffoldApp(parsedArgs);
    await emitScaffoldAppResult(result, parsedArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scaffold error.";
    console.error(`create-cf-starter failed: ${message}`);
    process.exit(1);
  }
}

const isDirectExecution =
  process.argv[1] != null &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const defaultSourceDir = resolve(scriptDir, "../..");

  await runScaffoldAppCli({
    sourceDir: defaultSourceDir,
    usage: "Usage: node scripts/internal/scaffold-app.mjs --target <dir> [--core-only] [--force] [--plan] [--json]",
  });
}
