import {
  EXAMPLE_RESIDUE_PATHS,
  GENERATED_APP_REMOVED_PATHS,
  OPTIONAL_EXAMPLE_PATHS,
  README_PATTERNS,
  STARTER_ONLY_SCRIPTS,
  STARTER_REPO_SENTINEL_PATH,
  normalizeCatalogPath,
} from "./starter-catalog.mjs";

function detectSelectedExampleFeatures(pathSet) {
  return Object.entries(OPTIONAL_EXAMPLE_PATHS)
    .filter(([, candidatePaths]) =>
      candidatePaths.some((candidatePath) => pathSet.has(normalizeCatalogPath(candidatePath)))
    )
    .map(([featureKey]) => featureKey);
}

export function analyzeGeneratedApp({
  packageJson,
  readme = "",
  wranglerConfig = {},
  existingPaths = [],
}) {
  const checks = [];
  const pathSet = new Set(existingPaths.map(normalizeCatalogPath));
  const scripts = packageJson?.scripts ?? {};
  const packageName = packageJson?.name ?? "";
  const isStarterRepo =
    packageName === "create-cf-starter" && pathSet.has(STARTER_REPO_SENTINEL_PATH);

  if (isStarterRepo) {
    checks.push({
      level: "info",
      code: "starter_repo_detected",
      message: "Starter repository detected; generated-app checks are skipped.",
    });
    return { ok: true, checks, skipped: true };
  }

  if (packageName === "create-cf-starter") {
    checks.push({
      level: "fail",
      code: "package_name_not_rewritten",
      message: "package.json name is still create-cf-starter.",
    });
  } else {
    checks.push({
      level: "pass",
      code: "package_name",
      message: `package.json name is ${packageName}.`,
    });
  }

  const starterPaths = GENERATED_APP_REMOVED_PATHS.filter((filePath) => pathSet.has(filePath));
  if (starterPaths.length > 0) {
    checks.push({
      level: "fail",
      code: "starter_files_present",
      message: `Starter-only files remain: ${starterPaths.join(", ")}`,
    });
  } else {
    checks.push({
      level: "pass",
      code: "starter_files_absent",
      message: "Starter-only files are not present.",
    });
  }

  const starterScripts = STARTER_ONLY_SCRIPTS.filter((scriptName) => scriptName in scripts);
  if (starterScripts.length > 0) {
    checks.push({
      level: "fail",
      code: "starter_scripts_present",
      message: `Starter-only npm scripts remain: ${starterScripts.join(", ")}`,
    });
  } else {
    checks.push({
      level: "pass",
      code: "starter_scripts_absent",
      message: "Starter-only npm scripts are not present.",
    });
  }

  const readmeHits = README_PATTERNS.filter((pattern) => readme.includes(pattern));
  if (readmeHits.length > 0) {
    checks.push({
      level: "fail",
      code: "starter_readme_residue",
      message: `README still mentions starter-only commands: ${readmeHits.join(", ")}`,
    });
  } else {
    checks.push({
      level: "pass",
      code: "readme_clean",
      message: "README does not mention starter-only commands.",
    });
  }

  const missingAppScripts = ["doctor", "seed:demo"].filter((scriptName) => !(scriptName in scripts));
  if (missingAppScripts.length > 0) {
    checks.push({
      level: "fail",
      code: "missing_app_scripts",
      message: `Missing app-ready scripts: ${missingAppScripts.join(", ")}`,
    });
  } else {
    checks.push({
      level: "pass",
      code: "app_scripts_present",
      message: "doctor and seed:demo scripts are present.",
    });
  }

  const selectedExampleFeatures = detectSelectedExampleFeatures(pathSet);
  const itemsMigrationPresent = pathSet.has("migrations/0010_example_items.sql");
  const exampleResidue = EXAMPLE_RESIDUE_PATHS.filter((filePath) => pathSet.has(filePath));

  if (selectedExampleFeatures.length === 0) {
    if (exampleResidue.length > 0) {
      checks.push({
        level: "fail",
        code: "example_residue_present",
        message: `Example directories remain in a core-first app: ${exampleResidue.join(", ")}`,
      });
    } else {
      checks.push({
        level: "pass",
        code: "example_residue_absent",
        message: "No optional example directories remain.",
      });
    }
  } else {
    checks.push({
      level: "pass",
      code: "selected_examples_detected",
      message: `Detected optional examples: ${selectedExampleFeatures.join(", ")}.`,
    });
  }

  if (selectedExampleFeatures.includes("items")) {
    if (itemsMigrationPresent) {
      checks.push({
        level: "pass",
        code: "items_migration_present",
        message: "items example migration is materialized in migrations/.",
      });
    } else {
      checks.push({
        level: "fail",
        code: "items_migration_missing",
        message: "items example is present, but migrations/0010_example_items.sql is missing.",
      });
    }
  } else if (itemsMigrationPresent) {
    checks.push({
      level: "fail",
      code: "items_migration_residue",
      message: "migrations/0010_example_items.sql remains even though the items example is not present.",
    });
  }

  const hasKvBinding = Array.isArray(wranglerConfig?.kv_namespaces) && wranglerConfig.kv_namespaces.length > 0;
  if (selectedExampleFeatures.includes("kv")) {
    if (hasKvBinding) {
      checks.push({
        level: "pass",
        code: "kv_binding_present",
        message: "KV binding is present for the kv example.",
      });
    } else {
      checks.push({
        level: "fail",
        code: "kv_binding_missing",
        message: "kv example is present, but wrangler.jsonc has no KV binding.",
      });
    }
  } else if (hasKvBinding) {
    checks.push({
      level: "fail",
      code: "kv_binding_residue",
      message: "wrangler.jsonc still has a KV binding even though the kv example is not present.",
    });
  }

  const hasBucketBinding = Array.isArray(wranglerConfig?.r2_buckets) && wranglerConfig.r2_buckets.length > 0;
  if (selectedExampleFeatures.includes("upload")) {
    if (hasBucketBinding) {
      checks.push({
        level: "pass",
        code: "bucket_binding_present",
        message: "R2 binding is present for the upload example.",
      });
    } else {
      checks.push({
        level: "fail",
        code: "bucket_binding_missing",
        message: "upload example is present, but wrangler.jsonc has no R2 binding.",
      });
    }
  } else if (hasBucketBinding) {
    checks.push({
      level: "fail",
      code: "bucket_binding_residue",
      message: "wrangler.jsonc still has an R2 binding even though the upload example is not present.",
    });
  }

  const primaryDatabase = wranglerConfig?.d1_databases?.[0];
  if (!primaryDatabase?.database_id || primaryDatabase.database_id === "TODO") {
    checks.push({
      level: "warn",
      code: "database_id_todo",
      message: "wrangler.jsonc still has TODO for d1 database_id.",
    });
  } else {
    checks.push({
      level: "pass",
      code: "database_id_set",
      message: "wrangler.jsonc has a concrete d1 database_id.",
    });
  }

  const vars = wranglerConfig?.vars ?? {};
  if (typeof vars.EMAIL_FROM === "string" && vars.EMAIL_FROM.includes("cf-starter")) {
    checks.push({
      level: "warn",
      code: "email_from_default",
      message: "EMAIL_FROM still contains cf-starter.",
    });
  }

  return {
    ok: !checks.some((check) => check.level === "fail"),
    checks,
    skipped: false,
  };
}
