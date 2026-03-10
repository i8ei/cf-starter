/**
 * Record Engine — defineRecord type definitions
 *
 * A record definition describes a business entity: its fields, status workflow,
 * list view columns, and form view sections. The generator reads these definitions
 * to produce Drizzle schema, Zod validation, Hono routes, and TanStack Query hooks.
 */

// ──────────────────────────────────────────────
// Field types
// ──────────────────────────────────────────────

export interface TextField {
  type: "text";
  label: string;
  required?: boolean;
  maxLength?: number;
  multiline?: boolean;
  defaultValue?: string;
}

export interface NumberField {
  type: "number";
  label: string;
  required?: boolean;
  min?: number;
  max?: number;
  defaultValue?: number;
}

export interface DateField {
  type: "date";
  label: string;
  required?: boolean;
  defaultValue?: string;
}

export interface SelectField {
  type: "select";
  label: string;
  required?: boolean;
  options: readonly string[];
  defaultValue?: string;
}

export interface RelationField {
  type: "relation";
  label: string;
  required?: boolean;
  relatedRecord: string;
  relatedLabel: string;
}

export interface FileField {
  type: "file";
  label: string;
  required?: boolean;
}

export type FieldDef =
  | TextField
  | NumberField
  | DateField
  | SelectField
  | RelationField
  | FileField;

// ──────────────────────────────────────────────
// Status definition
// ──────────────────────────────────────────────

export interface StatusDef {
  field: string;
  label: string;
  options: readonly string[];
  defaultValue: string;
}

// ──────────────────────────────────────────────
// List view
// ──────────────────────────────────────────────

export interface ListViewDef {
  columns: readonly string[];
  defaultSort: {
    field: string;
    direction: "asc" | "desc";
  };
}

// ──────────────────────────────────────────────
// Form view
// ──────────────────────────────────────────────

export interface FormSectionDef {
  label: string;
  fields: readonly string[];
}

export interface FormViewDef {
  sections: readonly FormSectionDef[];
}

// ──────────────────────────────────────────────
// Record definition
// ──────────────────────────────────────────────

export interface RecordDef {
  key: string;
  label: string;
  tableName: string;
  fields: Record<string, FieldDef>;
  status?: StatusDef;
  listView: ListViewDef;
  formView: FormViewDef;
}

/**
 * Define a record. This is the entry point for record definitions.
 * The function is identity at runtime — it exists for type inference.
 */
export function defineRecord<T extends RecordDef>(def: T): T {
  return def;
}
