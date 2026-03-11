import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildScaffoldPlan, scaffoldStarter } from "../lib/scaffold.mjs";

function warnDeprecatedModeField(writer = console.error) {
  writer('[deprecated] JSON field "mode" remains for compatibility. Prefer "profile" and "selectedFeatures".');
}

function printScaffoldSummary(result, { modeLabel, writer = console.log, concise = false }) {
  const featureProfile =
    result.profile === "optional-examples"
      ? `optional examples: ${result.selectedFeatures.join(", ")}`
      : result.profile;

  writer(`${modeLabel} ${result.appName}`);
  writer(`Target: ${result.targetDir}`);
  writer(`Feature profile: ${featureProfile}`);
  writer(`Required bindings: ${result.requiredBindings.join(", ")}`);
  if (concise) {
    writer(`Next steps: ${result.nextSteps.join(" | ")}`);
    return;
  }
  writer(`Selected features: ${result.selectedFeatures.length > 0 ? result.selectedFeatures.join(", ") : "none"}`);
  writer(`Core bindings kept: ${result.coreBindingsKept.join(", ")}`);
  if (result.coreBindingsKept.length > 0) {
    writer("Core binding reasons:");
    for (const binding of result.coreBindingsKept) {
      writer(`- ${binding}: ${result.coreBindingReasons[binding]}`);
    }
  }
  if (result.bindingsRemoved.length > 0) {
    writer(`Bindings removed: ${result.bindingsRemoved.join(", ")}`);
    writer("Binding removal reasons:");
    for (const binding of result.bindingsRemoved) {
      writer(`- ${binding}: ${result.bindingRemovalReasons[binding]}`);
    }
  }
  if (result.removedFeatures.length > 0) {
    writer(`Removed features: ${result.removedFeatures.join(", ")}`);
  }
  if (result.filesRemoved.length > 0) {
    writer(`Files removed: ${result.filesRemoved.join(", ")}`);
  }
  writer(`Files rewritten: ${result.filesRewritten.join(", ")}`);
  if (result.warnings.length > 0) {
    writer("Warnings:");
    for (const warning of result.warnings) {
      writer(`- ${warning}`);
    }
  }
  writer("Transforms:");
  for (const transform of result.transforms) {
    writer(`- ${transform}`);
  }
  writer("Next steps:");
  for (const step of result.nextSteps) {
    writer(`- ${step}`);
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

  const args = argv;
  const targetIndex = args.findIndex((arg) => arg === "--target");
  const appNameIndex = args.findIndex((arg) => arg === "--app-name");
  const sourceDirIndex = args.findIndex((arg) => arg === "--source-dir");
  const coreOnly = args.includes("--core-only");
  const force = args.includes("--force");
  const asJson = args.includes("--json");
  const planOnly = args.includes("--plan");
  const includeIndex = args.findIndex((arg) => arg === "--include");
  const excludeIndex = args.findIndex((arg) => arg === "--exclude");
  const jsonOutIndex = args.findIndex((arg) => arg === "--json-out");
  const planOutIndex = args.findIndex((arg) => arg === "--plan-out");

  function fail(message, { includeUsage = false } = {}) {
    console.error(message);
    if (includeUsage && usage) {
      console.error(usage);
    }
    process.exit(1);
  }

  if (targetIndex === -1 || !args[targetIndex + 1]) {
    fail("Missing required --target option.", { includeUsage: true });
  }

  const resolvedTargetDir = resolve(process.cwd(), args[targetIndex + 1]);
  const resolvedSourceDir =
    sourceDirIndex === -1 || !args[sourceDirIndex + 1]
      ? sourceDir
      : resolve(process.cwd(), args[sourceDirIndex + 1]);
  const appName = appNameIndex === -1 ? undefined : args[appNameIndex + 1];
  const include =
    includeIndex === -1 || !args[includeIndex + 1]
      ? undefined
      : args[includeIndex + 1].split(",").map((value) => value.trim()).filter(Boolean);
  const exclude =
    excludeIndex === -1 || !args[excludeIndex + 1]
      ? undefined
      : args[excludeIndex + 1].split(",").map((value) => value.trim()).filter(Boolean);
  const jsonOutPath =
    jsonOutIndex === -1 || !args[jsonOutIndex + 1]
      ? undefined
      : resolve(process.cwd(), args[jsonOutIndex + 1]);
  const planOutPath =
    planOutIndex === -1 || !args[planOutIndex + 1]
      ? undefined
      : resolve(process.cwd(), args[planOutIndex + 1]);

  if (planOutPath && !planOnly) {
    fail("--plan-out can only be used together with --plan.");
  }

  const options = {
    targetDir: resolvedTargetDir,
    appName,
    coreOnly,
    include,
    exclude,
  };

  const conciseSummary = Boolean(jsonOutPath || planOutPath);

  try {
    const result = planOnly
      ? buildScaffoldPlan(options)
      : await scaffoldStarter({
          sourceDir: resolvedSourceDir,
          ...options,
          force,
        });

    if (asJson || jsonOutPath || planOutPath) {
      warnDeprecatedModeField();
    }

    if (asJson) {
      printScaffoldSummary(result, {
        modeLabel: planOnly ? "Scaffold plan for" : "Scaffolded",
        writer: (line) => console.error(line),
        concise: conciseSummary,
      });
      console.log(JSON.stringify(result, null, 2));
    } else if (planOnly) {
      printScaffoldSummary(result, { modeLabel: "Scaffold plan for", concise: conciseSummary });
    } else {
      printScaffoldSummary(result, { modeLabel: "Scaffolded", concise: conciseSummary });
    }

    if (jsonOutPath) {
      await writeFile(jsonOutPath, `${JSON.stringify(result, null, 2)}\n`);
    }

    if (planOutPath) {
      await writeFile(planOutPath, `${JSON.stringify(result, null, 2)}\n`);
    }
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
