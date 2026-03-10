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

// ── CLI args ───────────────────────────────────
const { values } = parseArgs({
  options: {
    record: { type: "string" },
  },
});

if (!values.record) {
  console.error("Usage: node scripts/generate-record.mjs --record <path>");
  process.exit(1);
}

// ── Load record definition ─────────────────────
// We use a dynamic import with tsx / ts-node not available,
// so we parse the TS file to extract the definition object.
// Strategy: transpile with esbuild (available via vite) or
// do a simple regex-based extraction. For robustness, we use
// esbuild which is already a dependency via vite.
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
const def = findRecordDef(mod);

if (!def) {
  console.error("No record definition found in the exported module.");
  console.error(
    "Make sure you export the result of defineRecord() as a named or default export."
  );
  process.exit(1);
}

console.log(`\nRecord Engine: generating "${def.key}" (${def.label})\n`);

// ── Helpers ────────────────────────────────────
function findRecordDef(mod) {
  // Find the first export that looks like a record definition
  for (const [, val] of Object.entries(mod)) {
    if (val && typeof val === "object" && val.key && val.tableName && val.fields) {
      return val;
    }
  }
  return null;
}

function pascalCase(s) {
  return s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
}

function camelCase(s) {
  return s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}

function snakeCase(s) {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, "");
}

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

const KEY = def.key;
const PASCAL = pascalCase(KEY);
const TABLE = def.tableName;
const fields = def.fields;
const status = def.status;
const fieldEntries = Object.entries(fields);

// ── 1. Drizzle table definition ────────────────
function generateDrizzleTable() {
  const schemaPath = resolve(process.cwd(), "src/db/schema.ts");
  const existing = readFileSync(schemaPath, "utf-8");

  // Check if table already exists
  if (existing.includes(`export const ${camelCase(TABLE)}`)) {
    console.log(`  [skip] Drizzle table "${TABLE}" already exists in schema.ts`);
    return;
  }

  const cols = [];

  // id (implicit)
  cols.push(
    `  id: integer("id").primaryKey({ autoIncrement: true })`
  );

  // organizationId (implicit)
  cols.push(
    `  organizationId: integer("organization_id").references(() => organizations.id, {\n    onDelete: "cascade",\n  })`
  );

  // user-defined fields
  for (const [name, field] of fieldEntries) {
    cols.push(generateDrizzleColumn(name, field));
  }

  // status field
  if (status) {
    cols.push(
      `  ${camelCase(status.field)}: text("${snakeCase(status.field)}").notNull().default("${status.defaultValue}")`
    );
  }

  // timestamps (implicit)
  cols.push(
    `  createdAt: text("created_at").notNull().default("(datetime('now'))")`
  );
  cols.push(
    `  updatedAt: text("updated_at").notNull().default("(datetime('now'))")`
  );

  const tableVar = camelCase(TABLE);
  const block = `\nexport const ${tableVar} = sqliteTable("${TABLE}", {\n${cols.join(",\n")},\n});\n`;

  writeFileSync(schemaPath, existing + block);
  console.log(`  [gen] src/db/schema.ts — added table "${TABLE}"`);
}

function generateDrizzleColumn(name, field) {
  const col = snakeCase(name);
  const notNull = field.required ? ".notNull()" : "";
  const defaultVal = field.defaultValue !== undefined
    ? `.default(${typeof field.defaultValue === "string" ? `"${field.defaultValue}"` : field.defaultValue})`
    : "";

  switch (field.type) {
    case "text":
      return `  ${name}: text("${col}")${notNull}${defaultVal}`;
    case "number":
      return `  ${name}: integer("${col}")${notNull}${defaultVal}`;
    case "date":
      return `  ${name}: text("${col}")${notNull}${defaultVal}`;
    case "select":
      return `  ${name}: text("${col}")${notNull}${defaultVal}`;
    case "relation":
      return `  ${name}: integer("${col}")${notNull}`;
    case "file":
      return `  ${name}: text("${col}")${notNull}`;
    default:
      return `  ${name}: text("${col}")${notNull}`;
  }
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

  const createFields = [];
  const updateFields = [];

  for (const [name, field] of fieldEntries) {
    const zodType = generateZodField(name, field, false);
    const zodTypeOptional = generateZodField(name, field, true);
    createFields.push(`  ${name}: ${zodType},`);
    updateFields.push(`  ${name}: ${zodTypeOptional},`);
  }

  // Status field in create schema (optional, uses default)
  if (status) {
    const opts = status.options.map((o) => `"${o}"`).join(", ");
    createFields.push(`  ${camelCase(status.field)}: z.enum([${opts}]).optional(),`);
    updateFields.push(`  ${camelCase(status.field)}: z.enum([${opts}]).optional(),`);
  }

  const content = `import { z } from "zod";

export const create${PASCAL}Schema = z.object({
${createFields.join("\n")}
});

export const update${PASCAL}Schema = z.object({
${updateFields.join("\n")}
});

// Cross-field validation hook — add custom refinements here:
// export const create${PASCAL}SchemaRefined = create${PASCAL}Schema.refine(
//   (data) => { /* your cross-field logic */ return true; },
//   { message: "..." }
// );

export type Create${PASCAL}Input = z.infer<typeof create${PASCAL}Schema>;
export type Update${PASCAL}Input = z.infer<typeof update${PASCAL}Schema>;
`;

  writeFileSync(outPath, content);
  console.log(`  [gen] shared/features/${KEY}/schema.ts`);
}

function generateZodField(name, field, forUpdate) {
  let z;
  switch (field.type) {
    case "text":
      z = "z.string()";
      if (field.maxLength) z += `.max(${field.maxLength})`;
      if (field.required && !forUpdate) z += ".min(1)";
      break;
    case "number":
      z = "z.number()";
      if (field.min !== undefined) z += `.min(${field.min})`;
      if (field.max !== undefined) z += `.max(${field.max})`;
      break;
    case "date":
      z = `z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "YYYY-MM-DD format required")`;
      break;
    case "select":
      z = `z.enum([${field.options.map((o) => `"${o}"`).join(", ")}])`;
      break;
    case "relation":
      z = "z.number().int()";
      break;
    case "file":
      z = "z.string()";
      break;
    default:
      z = "z.string()";
  }

  if (forUpdate) {
    z += ".optional()";
  } else if (!field.required) {
    z += ".optional()";
  }

  return z;
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

  const tableVar = camelCase(TABLE);
  const schemaImportPath = `../../../shared/features/${KEY}/schema`;

  // Build the set object for update
  const updateSetFields = fieldEntries
    .map(([name]) => `          ...(${name} !== undefined ? { ${name} } : {})`)
    .join(",\n");
  const updateDestructure = fieldEntries.map(([name]) => name).join(", ");

  // Status set field
  const statusSetField = status
    ? `,\n          ...(${camelCase(status.field)} !== undefined ? { ${camelCase(status.field)} } : {})`
    : "";
  const statusDestructure = status ? `, ${camelCase(status.field)}` : "";

  // Status change endpoint
  const statusRoute = status ? generateStatusRoute(tableVar) : "";

  const zodImport = status ? `\nimport { z } from "zod";` : "";

  const content = `import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";${zodImport}
import { ${tableVar} } from "../../db/schema";
import {
  create${PASCAL}Schema,
  update${PASCAL}Schema,
} from "${schemaImportPath}";
import { requireAuth } from "../../middleware/auth";
import type { AppContextEnv } from "../../types";
import { writeAuditLog } from "../../lib/audit";
import { jsonError } from "../../lib/http";
import { validator } from "../../lib/validator";

const app = new Hono<AppContextEnv>()
  .use("*", requireAuth)
  // LIST
  .get("/", async (c) => {
    const orgId = c.get("orgId");
    if (!orgId) {
      return jsonError(c, 403, "org_context_required", "Current organization is required");
    }
    const db = drizzle(c.env.DB);
    const rows = await db
      .select()
      .from(${tableVar})
      .where(eq(${tableVar}.organizationId, orgId))
      .orderBy(desc(${tableVar}.${getDefaultSortField()}));
    return c.json(rows);
  })
  // CREATE
  .post(
    "/",
    validator("json", create${PASCAL}Schema),
    async (c) => {
      const orgId = c.get("orgId");
      if (!orgId) {
        return jsonError(c, 403, "org_context_required", "Current organization is required");
      }
      const db = drizzle(c.env.DB);
      const body = c.req.valid("json");
      const [row] = await db
        .insert(${tableVar})
        .values({ organizationId: orgId, ...body })
        .returning();
      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
        organizationId: orgId,
        action: "${KEY}.create",
        resourceType: "${KEY}",
        resourceId: String(row.id),
        status: 201,
        metadata: body,
      });
      return c.json(row, 201);
    }
  )
  // GET ONE
  .get("/:id", async (c) => {
    const orgId = c.get("orgId");
    if (!orgId) {
      return jsonError(c, 403, "org_context_required", "Current organization is required");
    }
    const db = drizzle(c.env.DB);
    const id = Number(c.req.param("id"));
    const [row] = await db
      .select()
      .from(${tableVar})
      .where(and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId)));
    if (!row) {
      return jsonError(c, 404, "not_found", "${PASCAL} not found");
    }
    return c.json(row);
  })
  // UPDATE
  .put(
    "/:id",
    validator("json", update${PASCAL}Schema),
    async (c) => {
      const orgId = c.get("orgId");
      if (!orgId) {
        return jsonError(c, 403, "org_context_required", "Current organization is required");
      }
      const db = drizzle(c.env.DB);
      const id = Number(c.req.param("id"));
      const { ${updateDestructure}${statusDestructure} } = c.req.valid("json");
      const [row] = await db
        .update(${tableVar})
        .set({
${updateSetFields}${statusSetField},
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId)))
        .returning();
      if (!row) {
        return jsonError(c, 404, "not_found", "${PASCAL} not found");
      }
      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
        organizationId: orgId,
        action: "${KEY}.update",
        resourceType: "${KEY}",
        resourceId: String(row.id),
        status: 200,
        metadata: { ${updateDestructure}${statusDestructure} },
      });
      return c.json(row);
    }
  )
  // DELETE
  .delete("/:id", async (c) => {
    const orgId = c.get("orgId");
    if (!orgId) {
      return jsonError(c, 403, "org_context_required", "Current organization is required");
    }
    const db = drizzle(c.env.DB);
    const id = Number(c.req.param("id"));
    const [row] = await db
      .delete(${tableVar})
      .where(and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId)))
      .returning();
    if (!row) {
      return jsonError(c, 404, "not_found", "${PASCAL} not found");
    }
    await writeAuditLog(c.env.DB, c, {
      actorUserId: c.get("userId") ?? null,
      organizationId: orgId,
      action: "${KEY}.delete",
      resourceType: "${KEY}",
      resourceId: String(row.id),
      status: 200,
    });
    return c.json({ ok: true });
  })${statusRoute};

export default app;
`;

  writeFileSync(outPath, content);
  console.log(`  [gen] src/features/${KEY}/routes.ts`);
}

function getDefaultSortField() {
  const sortField = def.listView?.defaultSort?.field;
  if (sortField && fieldEntries.some(([name]) => name === sortField)) {
    return sortField;
  }
  return "createdAt";
}

function generateStatusRoute(tableVar) {
  const statusField = camelCase(status.field);
  const opts = status.options.map((o) => `"${o}"`).join(", ");

  return `
  // STATUS CHANGE
  .patch(
    "/:id/status",
    validator("json", z.object({ ${statusField}: z.enum([${opts}]) })),
    async (c) => {
      const orgId = c.get("orgId");
      if (!orgId) {
        return jsonError(c, 403, "org_context_required", "Current organization is required");
      }
      const db = drizzle(c.env.DB);
      const id = Number(c.req.param("id"));
      const { ${statusField} } = c.req.valid("json");

      // Get current status for audit
      const [current] = await db
        .select({ ${statusField}: ${tableVar}.${statusField} })
        .from(${tableVar})
        .where(and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId)));
      if (!current) {
        return jsonError(c, 404, "not_found", "${PASCAL} not found");
      }

      const [row] = await db
        .update(${tableVar})
        .set({ ${statusField}, updatedAt: new Date().toISOString() })
        .where(and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId)))
        .returning();

      await writeAuditLog(c.env.DB, c, {
        actorUserId: c.get("userId") ?? null,
        organizationId: orgId,
        action: "${KEY}.status_change",
        resourceType: "${KEY}",
        resourceId: String(row.id),
        status: 200,
        metadata: { from: current.${statusField}, to: ${statusField} },
      });
      return c.json(row);
    }
  )`;
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

  const queryKey = `${KEY.toUpperCase()}_KEY`;

  // Build the record type from fields
  const typeFields = [];
  typeFields.push("  id: number;");
  typeFields.push("  organizationId: number | null;");
  for (const [name, field] of fieldEntries) {
    const tsType = fieldToTsType(field);
    const optional = field.required ? "" : " | null";
    typeFields.push(`  ${name}: ${tsType}${optional};`);
  }
  if (status) {
    typeFields.push(`  ${camelCase(status.field)}: string;`);
  }
  typeFields.push("  createdAt: string;");
  typeFields.push("  updatedAt: string;");

  // Create input type
  const createFields = [];
  for (const [name, field] of fieldEntries) {
    const tsType = fieldToTsType(field);
    const optional = field.required ? "" : "?";
    createFields.push(`  ${name}${optional}: ${tsType};`);
  }
  if (status) {
    createFields.push(`  ${camelCase(status.field)}?: string;`);
  }

  const statusHook = status ? generateStatusHook(queryKey) : "";

  const content = `import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "~/lib/api";
import { readApiError } from "~/lib/errors";
import type { Create${PASCAL}Input, Update${PASCAL}Input } from "@shared/features/${KEY}/schema";

const ${queryKey} = ["${KEY}"] as const;

export type ${PASCAL}Record = {
${typeFields.join("\n")}
};

export function use${PASCAL}s(enabled: boolean) {
  return useQuery({
    queryKey: ${queryKey},
    enabled,
    queryFn: async () => {
      const res = await client.api.${KEY}.$get();
      if (!res.ok) throw new Error(await readApiError(res, "Failed to fetch ${KEY}"));
      return (await res.json()) as ${PASCAL}Record[];
    },
  });
}

export function use${PASCAL}(id: number, enabled: boolean) {
  return useQuery({
    queryKey: [...${queryKey}, id],
    enabled,
    queryFn: async () => {
      const res = await client.api.${KEY}[":id"].$get({
        param: { id: String(id) },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to fetch ${KEY}"));
      return (await res.json()) as ${PASCAL}Record;
    },
  });
}

export function useCreate${PASCAL}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Create${PASCAL}Input) => {
      const res = await client.api.${KEY}.$post({ json: input });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to create ${KEY}"));
      return (await res.json()) as ${PASCAL}Record;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}

export function useUpdate${PASCAL}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Update${PASCAL}Input & { id: number }) => {
      const res = await client.api.${KEY}[":id"].$put({
        param: { id: String(id) },
        json: input,
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update ${KEY}"));
      return (await res.json()) as ${PASCAL}Record;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}

export function useDelete${PASCAL}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await client.api.${KEY}[":id"].$delete({
        param: { id: String(id) },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to delete ${KEY}"));
      return (await res.json()) as { ok: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}
${statusHook}`;

  writeFileSync(outPath, content);
  console.log(`  [gen] app/features/${KEY}/hooks/use${PASCAL}.ts`);
}

function generateStatusHook(queryKey) {
  const statusField = camelCase(status.field);
  return `
export function useUpdate${PASCAL}Status() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ${statusField} }: { id: number; ${statusField}: string }) => {
      const res = await (client.api.${KEY}[":id"].status as any).$patch({
        param: { id: String(id) },
        json: { ${statusField} },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update status"));
      return (await res.json()) as ${PASCAL}Record;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}
`;
}

function fieldToTsType(field) {
  switch (field.type) {
    case "text":
    case "date":
    case "select":
    case "file":
      return "string";
    case "number":
    case "relation":
      return "number";
    default:
      return "string";
  }
}

// ── 5. Route registration in src/index.ts ──────
function registerRoute() {
  const indexPath = resolve(process.cwd(), "src/index.ts");
  const existing = readFileSync(indexPath, "utf-8");

  // Check if already registered
  if (existing.includes(`/api/${KEY}`)) {
    console.log(`  [skip] Route "/api/${KEY}" already registered in src/index.ts`);
    return;
  }

  // Add import after the last import line
  const importLine = `import ${KEY}Routes from "./features/${KEY}/routes";`;

  // Find the last import statement
  const lines = existing.split("\n");
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex === -1) {
    console.error("  [error] Could not find import statements in src/index.ts");
    return;
  }

  // Insert import
  lines.splice(lastImportIndex + 1, 0, importLine);

  // Find the route registration block and add before the last .route()
  // Look for the pattern .route("/api/auth", auth);
  let routeInsertIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('.route("/api/auth"')) {
      routeInsertIndex = i;
      break;
    }
  }

  if (routeInsertIndex === -1) {
    // Fallback: find the last .route() line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(".route(")) {
        routeInsertIndex = i;
      }
    }
  }

  if (routeInsertIndex === -1) {
    console.error("  [error] Could not find route registration block in src/index.ts");
    return;
  }

  const routeLine = `  .route("/api/${KEY}", ${KEY}Routes)`;
  lines.splice(routeInsertIndex, 0, routeLine);

  writeFileSync(indexPath, lines.join("\n"));
  console.log(`  [gen] src/index.ts — registered route "/api/${KEY}"`);
}

// ── Run all generators ─────────────────────────
generateDrizzleTable();
generateZodSchemas();
generateRoutes();
generateHooks();
registerRoute();

console.log(`\nDone! Next steps:`);
console.log(`  1. npm run db:generate    # Generate migration`);
console.log(`  2. npm run db:migrate     # Apply migration`);
console.log(`  3. npm run dev            # Start dev server`);
console.log("");
