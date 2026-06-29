/**
 * Record Engine — Pure generation logic (testable, no side effects)
 *
 * All functions here are pure: they take input strings/objects and return
 * output strings or results. File I/O is handled by the caller.
 */

// ── String helpers ──────────────────────────────

export function pascalCase(s) {
  return s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
}

export function camelCase(s) {
  return s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}

/**
 * Convert a hyphenated key to camelCase for use as a JavaScript identifier.
 * e.g. "ride-records" → "rideRecords"
 */
export function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function snakeCase(s) {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, "");
}

// ── Record definition detection ─────────────────

export function findRecordDef(mod) {
  for (const [exportName, val] of Object.entries(mod)) {
    if (val && typeof val === "object" && val.key && val.tableName && val.fields) {
      return { def: val, exportName };
    }
  }
  return null;
}

/**
 * Resolve the expected export name for a record definition.
 * Convention: `${key}Def` (e.g., key "tasks" → "tasksDef").
 * If the actual export name differs, warn and return the actual name.
 */
export function resolveDefExportName(key, actualExportName) {
  const expected = `${key}Def`;
  if (actualExportName !== expected && actualExportName !== "default") {
    return { name: actualExportName, warning: `Export name "${actualExportName}" does not match convention "${expected}". Generated pages will import as "${actualExportName}".` };
  }
  return { name: expected, warning: null };
}

// ── Record definition validation ────────────────

const VALID_FIELD_TYPES = ["text", "number", "date", "select", "relation", "file"];

/**
 * Validate a record definition for referential integrity.
 * Returns an array of error messages (empty = valid).
 * @param {object} def - Record definition object from defineRecord()
 * @returns {string[]}
 */
export function validateRecordDef(def) {
  const errors = [];
  const fieldKeys = Object.keys(def.fields || {});
  const statusFieldName = def.status?.field ? camelCase(def.status.field) : null;

  // Validate field types
  for (const [name, field] of Object.entries(def.fields || {})) {
    if (!VALID_FIELD_TYPES.includes(field.type)) {
      errors.push(`Field "${name}" has invalid type "${field.type}". Valid types: ${VALID_FIELD_TYPES.join(", ")}`);
    }
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      errors.push(`Select field "${name}" must have a non-empty "options" array`);
    }
    if (field.type === "relation" && !field.relatedRecord) {
      errors.push(`Relation field "${name}" must have a "relatedRecord" property`);
    }
  }

  // Validate status
  if (def.status) {
    if (def.status.defaultValue && def.status.options && !def.status.options.includes(def.status.defaultValue)) {
      errors.push(`status.defaultValue "${def.status.defaultValue}" is not in status.options [${def.status.options.join(", ")}]`);
    }
  }

  // Validate listView.columns
  if (def.listView?.columns) {
    for (const col of def.listView.columns) {
      if (!fieldKeys.includes(col) && col !== statusFieldName) {
        errors.push(`listView.columns references unknown field "${col}". Valid fields: ${[...fieldKeys, ...(statusFieldName ? [statusFieldName] : [])].join(", ")}`);
      }
    }
  }

  // Validate formView.sections
  if (def.formView?.sections) {
    for (const section of def.formView.sections) {
      for (const f of section.fields || []) {
        if (!fieldKeys.includes(f)) {
          errors.push(`formView section "${section.label}" references unknown field "${f}". Valid fields: ${fieldKeys.join(", ")}`);
        }
      }
    }
  }

  return errors;
}

// ── Duplicate detection ─────────────────────────

/**
 * Check whether schema.ts already contains the given table.
 * Matches both `export const tableVar =` and `sqliteTable("tableName"`.
 */
export function schemaHasTable(schemaContent, tableName) {
  const tableVar = camelCase(tableName);
  return (
    schemaContent.includes(`export const ${tableVar}`) ||
    schemaContent.includes(`sqliteTable("${tableName}"`)
  );
}

/**
 * Check whether index.ts already has a route for the given key.
 */
export function indexHasRoute(indexContent, key) {
  return (
    indexContent.includes(`"/api/${key}"`) ||
    indexContent.includes(`'/api/${key}'`)
  );
}

// ── 1. Drizzle table generation ─────────────────

export function generateDrizzleColumn(name, field) {
  const col = snakeCase(name);
  const notNull = field.required ? ".notNull()" : "";
  const defaultVal =
    field.defaultValue !== undefined
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

/**
 * Generate the Drizzle table block string for appending to schema.ts.
 * Returns { ok: true, content } or { ok: false, reason }.
 */
export function generateDrizzleTableBlock(def) {
  const fieldEntries = Object.entries(def.fields);
  const TABLE = def.tableName;
  const status = def.status;
  const cols = [];

  cols.push(`  id: integer("id").primaryKey({ autoIncrement: true })`);
  cols.push(
    `  organizationId: text("organization_id")\n    .notNull()\n    .references(() => organization.id, {\n      onDelete: "cascade",\n    })`
  );

  for (const [name, field] of fieldEntries) {
    cols.push(generateDrizzleColumn(name, field));
  }

  if (status) {
    cols.push(
      `  ${camelCase(status.field)}: text("${snakeCase(status.field)}").notNull().default("${status.defaultValue}")`
    );
  }

  if (def.softDelete) {
    cols.push(`  deletedAt: text("deleted_at")`);
  }

  cols.push(
    `  createdAt: text("created_at").notNull().default("(datetime('now'))")`
  );
  cols.push(
    `  updatedAt: text("updated_at").notNull().default("(datetime('now'))")`
  );

  const tableVar = camelCase(TABLE);
  const block = `\nexport const ${tableVar} = sqliteTable("${TABLE}", {\n${cols.join(",\n")},\n}, (table) => [index("${TABLE}_organization_id_idx").on(table.organizationId)]);\n`;

  return { ok: true, content: block };
}

/**
 * Append a Drizzle table block to schema content.
 * Returns { ok, content, reason, skipped }.
 */
export function appendDrizzleTable(existingSchema, def) {
  if (schemaHasTable(existingSchema, def.tableName)) {
    return {
      ok: true,
      content: existingSchema,
      skipped: true,
      reason: `Table "${def.tableName}" already exists in schema.ts`,
    };
  }

  const result = generateDrizzleTableBlock(def);
  if (!result.ok) return result;

  // Ensure `index` is imported from drizzle-orm/sqlite-core
  let schema = existingSchema;
  if (!schema.includes("index") || !schema.match(/\bindex\b.*from\s+["']drizzle-orm\/sqlite-core["']/)) {
    schema = schema.replace(
      /(import\s*\{[^}]*)(}\s*from\s*["']drizzle-orm\/sqlite-core["'])/,
      (match, imports, tail) => {
        if (/\bindex\b/.test(imports)) return match;
        return `${imports.trimEnd()}, index ${tail}`;
      }
    );
  }

  // Trim trailing whitespace/newlines for a clean insertion point,
  // then append the block followed by a final newline.
  const trimmed = schema.trimEnd();
  return {
    ok: true,
    content: trimmed + result.content,
    skipped: false,
  };
}

// ── 2. Zod schema generation ────────────────────

export function generateZodField(name, field, forUpdate) {
  let z;
  switch (field.type) {
    case "text":
      z = "z.string()";
      if (field.maxLength) z += `.max(${field.maxLength})`;
      if (field.required && !forUpdate) z += ".min(1)";
      break;
    case "number":
      z = "z.coerce.number()";
      if (field.min !== undefined) z += `.min(${field.min})`;
      if (field.max !== undefined) z += `.max(${field.max})`;
      break;
    case "date":
      // Format check (regex) + real calendar validity (rejects 2024-02-30 etc.).
      // The refine is self-contained (no Date global) so it runs anywhere.
      z =
        `z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "YYYY-MM-DD format required")` +
        `.refine((s) => { const [y, m, d] = s.split("-").map(Number); if (m < 1 || m > 12 || d < 1) return false; const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0); const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; return d <= days[m - 1]; }, "invalid calendar date")`;
      break;
    case "select":
      z = `z.enum([${field.options.map((o) => `"${o}"`).join(", ")}])`;
      break;
    case "relation":
      z = "z.coerce.number().int()";
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

/**
 * Generate the full Zod schema file content.
 */
export function generateZodSchemaContent(def) {
  const PASCAL = pascalCase(def.key);
  const fieldEntries = Object.entries(def.fields);
  const status = def.status;

  const createFields = [];
  const updateFields = [];

  for (const [name, field] of fieldEntries) {
    const zodType = generateZodField(name, field, false);
    const zodTypeOptional = generateZodField(name, field, true);
    createFields.push(`  ${name}: ${zodType},`);
    updateFields.push(`  ${name}: ${zodTypeOptional},`);
  }

  if (status) {
    const opts = status.options.map((o) => `"${o}"`).join(", ");
    createFields.push(
      `  ${camelCase(status.field)}: z.enum([${opts}]).optional(),`
    );
    updateFields.push(
      `  ${camelCase(status.field)}: z.enum([${opts}]).optional(),`
    );
  }

  return `import { z } from "zod";

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
}

// ── 5. Route registration in index.ts ───────────

/**
 * Insert import and .route() registration into index.ts content.
 * Returns { ok, content, reason, skipped }.
 */
export function insertRouteRegistration(existingIndex, key) {
  // Duplicate check
  if (indexHasRoute(existingIndex, key)) {
    return {
      ok: true,
      content: existingIndex,
      skipped: true,
      reason: `Route "/api/${key}" already registered in src/index.ts`,
    };
  }

  const varName = toCamelCase(key);
  const importLine = `import ${varName}Routes from "./features/${key}/routes";`;
  const lines = existingIndex.split("\n");

  // Find the last import statement (supports `import` and `import {`)
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex === -1) {
    return {
      ok: false,
      content: existingIndex,
      reason:
        "Could not find any import statements in src/index.ts. The file may be empty or have an unexpected structure.",
    };
  }

  // Insert import after the last import line
  lines.splice(lastImportIndex + 1, 0, importLine);

  // Find the route registration block.
  // Strategy: look for the last `.route(` line that ends with `;` (the chain terminator).
  // We insert our new route BEFORE that line.
  // If no semicolon-terminated .route() exists, fall back to inserting after the last .route().
  let lastRouteSemicolonIndex = -1;
  let lastRouteIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.includes(".route(")) {
      lastRouteIndex = i;
      if (trimmed.endsWith(";")) {
        lastRouteSemicolonIndex = i;
      }
    }
  }

  let routeInsertIndex;
  if (lastRouteSemicolonIndex !== -1) {
    // Insert before the semicolon-terminated .route() line (typically the auth route)
    routeInsertIndex = lastRouteSemicolonIndex;
  } else if (lastRouteIndex !== -1) {
    // Insert after the last .route() line
    routeInsertIndex = lastRouteIndex + 1;
  } else {
    return {
      ok: false,
      content: existingIndex,
      reason:
        "Could not find any .route() registration in src/index.ts. Please add at least one route before running the generator.",
    };
  }

  const routeLine = `  .route("/api/${key}", ${varName}Routes)`;
  lines.splice(routeInsertIndex, 0, routeLine);

  return {
    ok: true,
    content: lines.join("\n"),
    skipped: false,
  };
}

// ── 6. Page generation ──────────────────────────

/**
 * Generate List/Detail/Form page wrapper files for a record.
 * Returns an array of { path, content } objects (relative paths).
 */
export function generatePages(def, defExportName, recordImportPath = def.key) {
  const KEY = def.key;
  const PASCAL = pascalCase(KEY);
  const status = def.status;
  const DEF_NAME = defExportName || `${KEY}Def`;

  // Collect relation fields for auto-populating options/labels
  const relationFields = Object.entries(def.fields)
    .filter(([, field]) => field.type === "relation")
    .map(([fieldKey, field]) => ({
      fieldKey,
      relatedRecord: field.relatedRecord,
      relatedLabel: field.relatedLabel || "name",
      relatedPascal: pascalCase(field.relatedRecord),
      relatedHookName: `use${pascalCase(field.relatedRecord)}List`,
      dataVar: camelCase(field.relatedRecord),
    }));

  const listPage = `import { use${PASCAL}List } from "~/features/${KEY}/hooks/use${PASCAL}";
import { RecordListPage } from "~/pages/records/RecordListPage";
import { ${DEF_NAME} } from "@shared/records/${recordImportPath}";

export function ${PASCAL}ListPage() {
  const { data, isLoading } = use${PASCAL}List(true);
  return <RecordListPage def={${DEF_NAME}} data={data?.rows ?? []} isLoading={isLoading} />;
}
`;

  const statusImport = status
    ? `\nimport { useUpdate${PASCAL}Status } from "~/features/${KEY}/hooks/use${PASCAL}";`
    : "";
  const statusHook = status
    ? `\n  const updateStatus = useUpdate${PASCAL}Status();`
    : "";
  const statusProp = status
    ? `\n      onStatusChange={(s) => updateStatus.mutate({ id, ${camelCase(status.field)}: s })}`
    : "";

  // Detail page: relation imports, hooks, and labels
  const detailRelationImports = relationFields
    .map((r) => `import { ${r.relatedHookName} } from "~/features/${r.relatedRecord}/hooks/use${r.relatedPascal}";`)
    .join("\n");
  const detailRelationImportBlock = detailRelationImports ? `\n${detailRelationImports}` : "";
  const detailRelationHooks = relationFields
    .map((r) => `\n  const { data: ${r.dataVar}Data } = ${r.relatedHookName}(true);\n  const ${r.dataVar} = ${r.dataVar}Data?.rows ?? [];`)
    .join("");
  const detailRelationLabelsEntries = relationFields
    .map((r) => `    ${r.fieldKey}: Object.fromEntries(${r.dataVar}.map((r: Record<string, unknown>) => [r.id as number, String(r.${r.relatedLabel} ?? r.id)])),`)
    .join("\n");
  const detailRelationLabelsProp = relationFields.length > 0
    ? `\n      relationLabels={{\n${detailRelationLabelsEntries}\n      }}`
    : "";

  const detailPage = `import { useLocation, useParams } from "wouter";
import { use${PASCAL}, useDelete${PASCAL} } from "~/features/${KEY}/hooks/use${PASCAL}";${statusImport}${detailRelationImportBlock}
import { RecordDetailPage } from "~/pages/records/RecordDetailPage";
import { ${DEF_NAME} } from "@shared/records/${recordImportPath}";

export function ${PASCAL}DetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const [, navigate] = useLocation();
  const { data, isLoading } = use${PASCAL}(id, true);
  const deleteMutation = useDelete${PASCAL}();${statusHook}${detailRelationHooks}

  return (
    <RecordDetailPage
      def={${DEF_NAME}}
      data={data}
      isLoading={isLoading}
      onDelete={() => deleteMutation.mutate(id, { onSuccess: () => navigate("/${KEY}") })}
      isDeleting={deleteMutation.isPending}${statusProp}${detailRelationLabelsProp}
    />
  );
}
`;

  // Form page: relation imports, hooks, and options
  const formRelationImports = relationFields
    .map((r) => `import { ${r.relatedHookName} } from "~/features/${r.relatedRecord}/hooks/use${r.relatedPascal}";`)
    .join("\n");
  const formRelationImportBlock = formRelationImports ? `\n${formRelationImports}` : "";
  const formRelationHooks = relationFields
    .map((r) => `\n  const { data: ${r.dataVar}Data } = ${r.relatedHookName}(true);\n  const ${r.dataVar} = ${r.dataVar}Data?.rows ?? [];`)
    .join("");
  const formRelationOptionsEntries = relationFields
    .map((r) => `    ${r.fieldKey}: ${r.dataVar}.map((r: Record<string, unknown>) => ({ id: r.id as number, label: String(r.${r.relatedLabel} ?? r.id) })),`)
    .join("\n");
  const formRelationOptionsProp = relationFields.length > 0
    ? `\n      relationOptions={{\n${formRelationOptionsEntries}\n      }}`
    : "";

  const formPage = `import { useLocation, useParams } from "wouter";
import {
  use${PASCAL},
  useCreate${PASCAL},
  useUpdate${PASCAL},
} from "~/features/${KEY}/hooks/use${PASCAL}";${formRelationImportBlock}
import { RecordFormPage } from "~/pages/records/RecordFormPage";
import { ${DEF_NAME} } from "@shared/records/${recordImportPath}";

export function ${PASCAL}FormPage({ mode }: { mode: "create" | "edit" }) {
  const { id: idParam } = useParams<{ id: string }>();
  const id = idParam ? Number(idParam) : undefined;
  const [, navigate] = useLocation();
  const { data: existing } = use${PASCAL}(id ?? 0, mode === "edit");
  const createMutation = useCreate${PASCAL}();
  const updateMutation = useUpdate${PASCAL}();${formRelationHooks}

  const handleSubmit = (data: Record<string, unknown>) => {
    if (mode === "create") {
      createMutation.mutate(data as Parameters<typeof createMutation.mutate>[0], {
        onSuccess: (row) => navigate(\`/${KEY}/\${row.id}\`),
      });
    } else if (id !== undefined) {
      updateMutation.mutate({ id, ...data } as Parameters<typeof updateMutation.mutate>[0], {
        onSuccess: () => navigate(\`/${KEY}/\${id}\`),
      });
    }
  };

  const mutation = mode === "create" ? createMutation : updateMutation;

  return (
    <RecordFormPage
      def={${DEF_NAME}}
      mode={mode}
      initialData={mode === "edit" ? (existing as Record<string, unknown> | undefined) : undefined}
      onSubmit={handleSubmit}
      isPending={mutation.isPending}
      error={mutation.error?.message ?? null}${formRelationOptionsProp}
    />
  );
}
`;

  return [
    { path: `app/pages/${KEY}/${PASCAL}ListPage.tsx`, content: listPage },
    { path: `app/pages/${KEY}/${PASCAL}DetailPage.tsx`, content: detailPage },
    { path: `app/pages/${KEY}/${PASCAL}FormPage.tsx`, content: formPage },
  ];
}

/**
 * Register a record's page routes and nav item in App.tsx.
 * Returns { ok, content, skipped, reason }.
 */
export function registerAppRoute(existingApp, def) {
  const KEY = def.key;
  const PASCAL = pascalCase(KEY);

  // Duplicate check — look for actual route registration, not comments
  const routePattern = new RegExp(`<Route[^>]+path=["']/${KEY}(?:/|["'])`);
  if (routePattern.test(existingApp)) {
    return {
      ok: true,
      content: existingApp,
      skipped: true,
      reason: `Route "/${KEY}" already registered in App.tsx`,
    };
  }

  let result = existingApp;

  // 1. Add imports after the last import line
  const importBlock = [
    `import { ${PASCAL}ListPage } from "./pages/${KEY}/${PASCAL}ListPage";`,
    `import { ${PASCAL}DetailPage } from "./pages/${KEY}/${PASCAL}DetailPage";`,
    `import { ${PASCAL}FormPage } from "./pages/${KEY}/${PASCAL}FormPage";`,
  ].join("\n");

  const lines = result.split("\n");
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) {
      lastImportIndex = i;
    }
  }
  if (lastImportIndex !== -1) {
    lines.splice(lastImportIndex + 1, 0, importBlock);
    result = lines.join("\n");
  }

  // 2. Add nav item to recordNavItems array
  const navEntry = `  { label: "${def.label}", href: "/${KEY}" },`;
  result = result.replace(
    /(const recordNavItems.*=\s*\[)([\s\S]*?)(];)/,
    (match, open, body, close) => {
      // Remove example comment line
      const cleaned = body.replace(/\s*\/\/ Example:.*\n/g, "\n");
      return `${open}${cleaned}${navEntry}\n${close}`;
    }
  );

  // 3. Add routes before the {/* record-engine:routes */} marker or before the 404 route
  const routeBlock = [
    `        <Route path="/${KEY}" component={${PASCAL}ListPage} />`,
    `        <Route path="/${KEY}/new">{() => <${PASCAL}FormPage mode="create" />}</Route>`,
    `        <Route path="/${KEY}/:id/edit">{() => <${PASCAL}FormPage mode="edit" />}</Route>`,
    `        <Route path="/${KEY}/:id" component={${PASCAL}DetailPage} />`,
  ].join("\n");

  if (result.includes("{/* record-engine:routes */}")) {
    result = result.replace(
      "{/* record-engine:routes */}",
      `${routeBlock}\n        {/* record-engine:routes */}`
    );
  } else {
    // Fallback: insert before the 404 catch-all route
    result = result.replace(
      /(\s*<Route>\s*\n\s*<div.*404)/,
      `\n${routeBlock}\n$1`
    );
  }

  return {
    ok: true,
    content: result,
    skipped: false,
  };
}

// ── Helpers for hooks/routes generation ─────────

export function fieldToTsType(field) {
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

export function getDefaultSortField(def) {
  const fieldEntries = Object.entries(def.fields);
  const sortField = def.listView?.defaultSort?.field;
  if (sortField && fieldEntries.some(([name]) => name === sortField)) {
    return sortField;
  }
  return "createdAt";
}

export function getAuditedFieldNames(def) {
  return Object.entries(def.fields)
    .filter(([, field]) => field.audit !== false && field.sensitive !== true)
    .map(([name]) => name);
}

export function generateAuditMetadataExpression(def, variableName = "body") {
  const auditedFields = getAuditedFieldNames(def);
  const statusField = def.status ? camelCase(def.status.field) : null;
  const entries = [
    ...auditedFields.map((name) => `    ${name}: ${variableName}.${name},`),
    ...(statusField ? [`    ${statusField}: ${variableName}.${statusField},`] : []),
  ];

  if (entries.length === 0) {
    return "null";
  }

  return `{\n${entries.join("\n")}\n  }`;
}

// ── 3. Hono routes generation ──────────────────

export function generateRoutesContent(def) {
  const KEY = def.key;
  const PASCAL = pascalCase(KEY);
  const TABLE = def.tableName;
  const fieldEntries = Object.entries(def.fields);
  const status = def.status;
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
  const statusRoute = status ? generateStatusRouteContent(def, tableVar) : "";

  const zodImport = status ? `\nimport { z } from "zod";` : "";

  const sortField = getDefaultSortField(def);
  const sd = def.softDelete;

  // Drizzle imports: add isNull when softDelete is enabled, always include sql for count
  const drizzleImports = sd
    ? `and, desc, eq, isNull, sql`
    : `and, desc, eq, sql`;

  // WHERE helpers for soft delete
  const listWhere = sd
    ? `and(eq(${tableVar}.organizationId, orgId), isNull(${tableVar}.deletedAt))`
    : `eq(${tableVar}.organizationId, orgId)`;
  const oneWhere = sd
    ? `and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId), isNull(${tableVar}.deletedAt))`
    : `and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId))`;

  // DELETE body: soft delete sets deletedAt, hard delete removes the row
  const deleteBody = sd
    ? `const [row] = await db
      .update(${tableVar})
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId)))
      .returning();`
    : `const [row] = await db
      .delete(${tableVar})
      .where(and(eq(${tableVar}.id, id), eq(${tableVar}.organizationId, orgId)))
      .returning();`;

  const createAuditMetadata = generateAuditMetadataExpression(def, "body");
  const updateAuditMetadata = generateAuditMetadataExpression(def, "input");

  return `import { Hono } from "hono";
import { ${drizzleImports} } from "drizzle-orm";
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
    const limit = Math.min(Number(c.req.query("limit") || 100), 500);
    const offset = Number(c.req.query("offset") || 0);

    const [{ count: total }] = await db
      .select({ count: sql<number>\`count(*)\` })
      .from(${tableVar})
      .where(${listWhere});

    const rows = await db
      .select()
      .from(${tableVar})
      .where(${listWhere})
      .orderBy(desc(${tableVar}.${sortField}))
      .limit(limit)
      .offset(offset);
    return c.json({ rows, total, limit, offset });
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
        metadata: ${createAuditMetadata},
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
      .where(${oneWhere});
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
      const input = c.req.valid("json");
      const { ${updateDestructure}${statusDestructure} } = input;
      const [row] = await db
        .update(${tableVar})
        .set({
${updateSetFields}${statusSetField},
          updatedAt: new Date().toISOString(),
        })
        .where(${oneWhere})
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
        metadata: ${updateAuditMetadata},
      });
      return c.json(row);
    }
  )
  // DELETE${sd ? " (soft)" : ""}
  .delete("/:id", async (c) => {
    const orgId = c.get("orgId");
    if (!orgId) {
      return jsonError(c, 403, "org_context_required", "Current organization is required");
    }
    const db = drizzle(c.env.DB);
    const id = Number(c.req.param("id"));
    ${deleteBody}
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
}

export function generateStatusRouteContent(def, tableVar) {
  const KEY = def.key;
  const PASCAL = pascalCase(KEY);
  const statusField = camelCase(def.status.field);
  const opts = def.status.options.map((o) => `"${o}"`).join(", ");

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

// ── 4. TanStack Query hooks generation ─────────

export function generateHooksContent(def) {
  const KEY = def.key;
  const PASCAL = pascalCase(KEY);
  const status = def.status;
  const queryKey = `${KEY.toUpperCase().replace(/-/g, "_")}_KEY`;
  const statusHook = status ? generateStatusHookContent(def, queryKey) : "";

  return `import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { client } from "~/lib/api";
import { readApiError } from "~/lib/errors";
import type { Create${PASCAL}Input, Update${PASCAL}Input } from "@shared/features/${KEY}/schema";

const ${queryKey} = ["${KEY}"] as const;

const listEndpoint = client.api["${KEY}"].$get;
const getEndpoint = client.api["${KEY}"][":id"].$get;
const createEndpoint = client.api["${KEY}"].$post;
const updateEndpoint = client.api["${KEY}"][":id"].$put;
const deleteEndpoint = client.api["${KEY}"][":id"].$delete;

type ApiErrorResponse = { error: { code: string; message: string; requestId: string | null } };
type SuccessResponse<T> = Exclude<T, ApiErrorResponse>;

export type ${PASCAL}ListResponse = SuccessResponse<InferResponseType<typeof listEndpoint, 200>>;
export type ${PASCAL}Record = SuccessResponse<InferResponseType<typeof getEndpoint, 200>>;
export type Create${PASCAL}Response = SuccessResponse<InferResponseType<typeof createEndpoint, 201>>;
export type Update${PASCAL}Response = SuccessResponse<InferResponseType<typeof updateEndpoint, 200>>;
export type Delete${PASCAL}Response = SuccessResponse<InferResponseType<typeof deleteEndpoint, 200>>;

export function use${PASCAL}List(enabled: boolean) {
  return useQuery({
    queryKey: ${queryKey},
    enabled,
    queryFn: async () => {
      const res = await listEndpoint();
      if (!res.ok) throw new Error(await readApiError(res, "Failed to fetch ${KEY}"));
      return (await res.json()) as ${PASCAL}ListResponse;
    },
  });
}

export function use${PASCAL}(id: number, enabled: boolean) {
  return useQuery({
    queryKey: [...${queryKey}, id],
    enabled,
    queryFn: async () => {
      const res = await getEndpoint({
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
      const res = await createEndpoint({ json: input });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to create ${KEY}"));
      return (await res.json()) as Create${PASCAL}Response;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}

export function useUpdate${PASCAL}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Update${PASCAL}Input & { id: number }) => {
      const res = await updateEndpoint({
        param: { id: String(id) },
        json: input,
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update ${KEY}"));
      return (await res.json()) as Update${PASCAL}Response;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}

export function useDelete${PASCAL}() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await deleteEndpoint({
        param: { id: String(id) },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to delete ${KEY}"));
      return (await res.json()) as Delete${PASCAL}Response;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}
${statusHook}`;
}

export function generateStatusHookContent(def, queryKey) {
  const KEY = def.key;
  const PASCAL = pascalCase(KEY);
  const statusField = camelCase(def.status.field);
  return `
const updateStatusEndpoint = client.api["${KEY}"][":id"]["status"].$patch;
export type Update${PASCAL}StatusResponse = SuccessResponse<InferResponseType<typeof updateStatusEndpoint, 200>>;

export function useUpdate${PASCAL}Status() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ${statusField} }: { id: number; ${statusField}: string }) => {
      const res = await updateStatusEndpoint({
        param: { id: String(id) },
        json: { ${statusField} },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to update status"));
      return (await res.json()) as Update${PASCAL}StatusResponse;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ${queryKey} }),
  });
}
`;
}
