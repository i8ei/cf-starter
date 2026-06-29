#!/usr/bin/env node
/**
 * Record Engine — Code Generator
 *
 * Usage:
 *   node scripts/generate-record.mjs --record shared/records/requests.ts
 *
 * Generates:
 *   1. Drizzle table definition → appended to src/db/schema.ts
 *   2. Zod schemas → shared/features/{key}/schema.ts
 *   3. Hono routes → src/features/{key}/routes.ts
 *   4. TanStack Query hooks → app/features/{key}/hooks/use{Key}.ts
 *   5. Route registration → appended to src/index.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parseArgs } from "node:util";
import { printReport } from "./lib/cli-report.mjs";
import {
  findRecordDef,
  resolveDefExportName,
  validateRecordDef,
  pascalCase,
  appendDrizzleTable,
  generateZodSchemaContent,
  generateRoutesContent,
  generateHooksContent,
  insertRouteRegistration,
  generatePages,
  registerAppRoute,
} from "./lib/record-engine.mjs";
import { buildRecordGenerationPlan } from "./lib/record-plan.mjs";

// ── CLI args ───────────────────────────────────
const { values } = parseArgs({
  options: {
    json: { type: "boolean" },
    plan: { type: "boolean" },
    record: { type: "string" },
  },
});

if (!values.record) {
  console.error("Usage: node scripts/generate-record.mjs --record <path>");
  process.exit(1);
}

// ── Load record definition ─────────────────────
const recordPath = resolve(process.cwd(), values.record);
if (!existsSync(recordPath)) {
  console.error(`Record file not found: ${recordPath}`);
  process.exit(1);
}

const { build } = await import("esbuild");
const tmpOut = resolve(process.cwd(), "node_modules/.cache/record-gen-tmp.mjs");
mkdirSync(dirname(tmpOut), { recursive: true });

await build({
  entryPoints: [recordPath],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: tmpOut,
  write: true,
  logLevel: "silent",
});

// Dynamic import of the transpiled file
const mod = await import(`file://${tmpOut}`);
const found = findRecordDef(mod);

if (!found) {
  console.error("No record definition found in the exported module.");
  console.error(
    "Make sure you export the result of defineRecord() as a named or default export."
  );
  process.exit(1);
}

const { def, exportName } = found;

// Validate record definition integrity
const validationErrors = validateRecordDef(def);
if (validationErrors.length > 0) {
  console.error("Record definition validation failed:");
  for (const err of validationErrors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

const { name: defExportName, warning: namingWarning } = resolveDefExportName(def.key, exportName);
if (namingWarning && !values.json) {
  console.warn(`  [warn] ${namingWarning}`);
}

if (!values.json) {
  console.log(`\nRecord Engine: generating "${def.key}" (${def.label})\n`);
}

// ── Helpers ────────────────────────────────────
function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

const KEY = def.key;
const PASCAL = pascalCase(KEY);
const TABLE = def.tableName;
const recordImportPath = values.record
  .replace(/^\.?\//, "")
  .replace(/^shared\/records\//, "")
  .replace(/\.[cm]?[tj]sx?$/, "");

const schemaPath = resolve(process.cwd(), "src/db/schema.ts");
const indexPath = resolve(process.cwd(), "src/index.ts");
const appPath = resolve(process.cwd(), "app/App.tsx");
const existingSchema = readFileSync(schemaPath, "utf-8");
const existingIndex = readFileSync(indexPath, "utf-8");
const existingApp = existsSync(appPath) ? readFileSync(appPath, "utf-8") : null;
const existingPaths = [
  `shared/features/${KEY}/schema.ts`,
  `src/features/${KEY}/routes.ts`,
  `app/features/${KEY}/hooks/use${PASCAL}.ts`,
  ...generatePages(def, defExportName, recordImportPath).map((page) => page.path),
].filter((relativePath) => existsSync(resolve(process.cwd(), relativePath)));

const basePlanReport = buildRecordGenerationPlan({
  def,
  defExportName,
  schemaContent: existingSchema,
  indexContent: existingIndex,
  appContent: existingApp,
  existingPaths,
});

if (!basePlanReport.ok) {
  const report = {
    ok: false,
    command: "record generate",
    mode: values.plan ? "plan" : "apply",
    target: "source",
    summary: [`Record generation failed for "${def.key}".`],
    checks: [],
    warnings: [],
    nextSteps: ["Fix the reported issue and rerun the generator."],
    error: {
      code: "record_generation_failed",
      message: basePlanReport.reason,
    },
  };
  printReport(report, { json: values.json });
  process.exit(1);
}

const planReport = {
  ...basePlanReport,
  warnings: namingWarning ? [...basePlanReport.warnings, namingWarning] : basePlanReport.warnings,
};

if (values.plan) {
  printReport(planReport, { json: values.json });
  process.exit(0);
}

// ── 1. Drizzle table definition ────────────────
function generateDrizzleTable() {
  const result = appendDrizzleTable(existingSchema, def);
  if (!result.ok) {
    console.error(`  [error] ${result.reason}`);
    process.exit(1);
  }
  if (result.skipped) {
    console.log(`  [skip] ${result.reason}`);
    return;
  }

  writeFileSync(schemaPath, result.content);
  console.log(`  [gen] src/db/schema.ts — added table "${TABLE}"`);
}

// ── 2. Zod schemas ─────────────────────────────
function generateZodSchemas() {
  const outPath = resolve(
    process.cwd(),
    `shared/features/${KEY}/schema.ts`
  );
  ensureDir(outPath);

  if (existsSync(outPath)) {
    console.log(`  [skip] Zod schema already exists: shared/features/${KEY}/schema.ts`);
    return;
  }

  const content = generateZodSchemaContent(def);
  writeFileSync(outPath, content);
  console.log(`  [gen] shared/features/${KEY}/schema.ts`);
}

// ── 3. Hono routes ─────────────────────────────
function generateRoutes() {
  const outPath = resolve(
    process.cwd(),
    `src/features/${KEY}/routes.ts`
  );
  ensureDir(outPath);

  if (existsSync(outPath)) {
    console.log(`  [skip] Routes already exist: src/features/${KEY}/routes.ts`);
    return;
  }

  writeFileSync(outPath, generateRoutesContent(def));
  console.log(`  [gen] src/features/${KEY}/routes.ts`);
}

// ── 4. TanStack Query hooks ────────────────────
function generateHooks() {
  const outPath = resolve(
    process.cwd(),
    `app/features/${KEY}/hooks/use${PASCAL}.ts`
  );
  ensureDir(outPath);

  if (existsSync(outPath)) {
    console.log(`  [skip] Hooks already exist: app/features/${KEY}/hooks/use${PASCAL}.ts`);
    return;
  }

  writeFileSync(outPath, generateHooksContent(def));
  console.log(`  [gen] app/features/${KEY}/hooks/use${PASCAL}.ts`);
}

// ── 5. Route registration in src/index.ts ──────
function registerRoute() {
  const result = insertRouteRegistration(existingIndex, KEY);
  if (!result.ok) {
    console.error(`  [error] ${result.reason}`);
    process.exit(1);
  }
  if (result.skipped) {
    console.log(`  [skip] ${result.reason}`);
    return;
  }

  writeFileSync(indexPath, result.content);
  console.log(`  [gen] src/index.ts — registered route "/api/${KEY}"`);
}

// ── 6. Page wrappers ─────────────────────────
function generatePageWrappers() {
  const pages = generatePages(def, defExportName, recordImportPath);
  for (const page of pages) {
    const outPath = resolve(process.cwd(), page.path);
    ensureDir(outPath);
    if (existsSync(outPath)) {
      console.log(`  [skip] Page already exists: ${page.path}`);
      continue;
    }
    writeFileSync(outPath, page.content);
    console.log(`  [gen] ${page.path}`);
  }
}

// ── 7. App.tsx route registration ────────────
function registerAppRoutes() {
  if (!existsSync(appPath)) {
    console.log(`  [skip] app/App.tsx not found — skipping route registration`);
    return;
  }
  const result = registerAppRoute(existingApp, def);
  if (!result.ok) {
    console.error(`  [error] ${result.reason}`);
    return;
  }
  if (result.skipped) {
    console.log(`  [skip] ${result.reason}`);
    return;
  }
  writeFileSync(appPath, result.content);
  console.log(`  [gen] app/App.tsx — registered routes and nav for "${KEY}"`);
}

// ── Run all generators ─────────────────────────
generateDrizzleTable();
generateZodSchemas();
generateRoutes();
generateHooks();
registerRoute();
generatePageWrappers();
registerAppRoutes();

if (values.json) {
  const report = {
    ...planReport,
    mode: "apply",
  };
  printReport(report, { json: true });
} else {
  console.log(`\nDone! Next steps:`);
  console.log(`  1. npm run db:generate    # Generate migration`);
  console.log(`  2. npm run db:migrate     # Apply migration`);
  console.log(`  3. npm run dev            # Start dev server`);
  console.log("");
}
