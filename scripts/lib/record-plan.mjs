import { appendDrizzleTable, generatePages, insertRouteRegistration, pascalCase, registerAppRoute } from "./record-engine.mjs";

export function buildRecordGenerationPlan({
  def,
  defExportName,
  schemaContent,
  indexContent,
  appContent = null,
  existingPaths = [],
}) {
  const existingPathSet = new Set(existingPaths);
  const changes = [];
  const warnings = [];

  const schemaResult = appendDrizzleTable(schemaContent, def);
  if (!schemaResult.ok) {
    return {
      ok: false,
      reason: schemaResult.reason,
    };
  }
  changes.push(
    schemaResult.skipped
      ? { kind: "file", path: "src/db/schema.ts", action: "skip", reason: schemaResult.reason }
      : { kind: "file", path: "src/db/schema.ts", action: "update" }
  );

  const zodPath = `shared/features/${def.key}/schema.ts`;
  changes.push(
    existingPathSet.has(zodPath)
      ? { kind: "file", path: zodPath, action: "skip", reason: "Schema file already exists." }
      : { kind: "file", path: zodPath, action: "create" }
  );

  const routesPath = `src/features/${def.key}/routes.ts`;
  changes.push(
    existingPathSet.has(routesPath)
      ? { kind: "file", path: routesPath, action: "skip", reason: "Route file already exists." }
      : { kind: "file", path: routesPath, action: "create" }
  );

  const hooksPath = `app/features/${def.key}/hooks/use${pascalCase(def.key)}.ts`;
  changes.push(
    existingPathSet.has(hooksPath)
      ? { kind: "file", path: hooksPath, action: "skip", reason: "Hooks file already exists." }
      : { kind: "file", path: hooksPath, action: "create" }
  );

  const indexResult = insertRouteRegistration(indexContent, def.key);
  if (!indexResult.ok) {
    return {
      ok: false,
      reason: indexResult.reason,
    };
  }
  changes.push(
    indexResult.skipped
      ? { kind: "file", path: "src/index.ts", action: "skip", reason: indexResult.reason }
      : { kind: "file", path: "src/index.ts", action: "update" }
  );

  for (const page of generatePages(def, defExportName)) {
    changes.push(
      existingPathSet.has(page.path)
        ? { kind: "file", path: page.path, action: "skip", reason: "Page file already exists." }
        : { kind: "file", path: page.path, action: "create" }
    );
  }

  if (appContent === null) {
    warnings.push("app/App.tsx not found. Frontend route registration will be skipped.");
  } else {
    const appResult = registerAppRoute(appContent, def);
    if (!appResult.ok) {
      return {
        ok: false,
        reason: appResult.reason,
      };
    }
    changes.push(
      appResult.skipped
        ? { kind: "file", path: "app/App.tsx", action: "skip", reason: appResult.reason }
        : { kind: "file", path: "app/App.tsx", action: "update" }
    );
  }

  const createCount = changes.filter((change) => change.action === "create").length;
  const updateCount = changes.filter((change) => change.action === "update").length;
  const skipCount = changes.filter((change) => change.action === "skip").length;

  return {
    ok: true,
    command: "record generate",
    mode: "plan",
    target: "source",
    summary: [
      `Record "${def.key}" will create ${createCount} file(s), update ${updateCount} file(s), and skip ${skipCount} file(s).`,
    ],
    checks: [],
    changes,
    warnings,
    nextSteps: [
      "Run without --plan to write generated files.",
      "After apply, run npm run db:generate and npm run db:migrate.",
    ],
  };
}
