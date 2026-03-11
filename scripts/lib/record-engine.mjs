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

export function snakeCase(s) {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, "");
}

// ── Record definition detection ─────────────────

export function findRecordDef(mod) {
  for (const [, val] of Object.entries(mod)) {
    if (val && typeof val === "object" && val.key && val.tableName && val.fields) {
      return val;
    }
  }
  return null;
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
    `  organizationId: integer("organization_id")\n    .notNull()\n    .references(() => organizations.id, {\n      onDelete: "cascade",\n    })`
  );

  for (const [name, field] of fieldEntries) {
    cols.push(generateDrizzleColumn(name, field));
  }

  if (status) {
    cols.push(
      `  ${camelCase(status.field)}: text("${snakeCase(status.field)}").notNull().default("${status.defaultValue}")`
    );
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

  const importLine = `import ${key}Routes from "./features/${key}/routes";`;
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

  const routeLine = `  .route("/api/${key}", ${key}Routes)`;
  lines.splice(routeInsertIndex, 0, routeLine);

  return {
    ok: true,
    content: lines.join("\n"),
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
