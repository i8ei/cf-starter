import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import type { AnyRecordDef, FieldDef } from "@shared/lib/record-def";
import { Panel } from "~/components/Panel";
import {
  TextField,
  NumberField,
  DateField,
  SelectField,
  RelationField,
} from "~/components/fields";

type Props = {
  def: AnyRecordDef;
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  error?: string | null;
  mode: "create" | "edit";
  relationOptions?: Record<string, { id: number; label: string }[]>;
};

/** Validate a single field value against its definition. Returns an error message or undefined. */
function validateFieldValue(field: FieldDef, value: unknown): string | undefined {
  if (
    field.required &&
    (value === "" || value === undefined || value === null)
  ) {
    return "必須項目です";
  }
  if (
    field.type === "text" &&
    field.maxLength &&
    typeof value === "string" &&
    value.length > field.maxLength
  ) {
    return `${field.maxLength}文字以内で入力してください`;
  }
  if (
    field.type === "number" &&
    value !== "" &&
    value !== undefined &&
    value !== null
  ) {
    const num = Number(value);
    if (field.min !== undefined && num < field.min) {
      return `${field.min}以上で入力してください`;
    }
    if (field.max !== undefined && num > field.max) {
      return `${field.max}以下で入力してください`;
    }
  }
  return undefined;
}

export function RecordFormPage({
  def,
  initialData,
  onSubmit,
  isPending,
  error,
  mode,
  relationOptions = {},
}: Props) {
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState<Record<string, unknown>>(() =>
    buildInitial(def, initialData)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(buildInitial(def, initialData));
      setErrors({});
    }
  }, [initialData, def]);

  const runValidation = useCallback(
    (key: string, value: unknown) => {
      const field = def.fields[key] as FieldDef | undefined;
      if (!field) return;
      const msg = validateFieldValue(field, value);
      setErrors((prev) => {
        if (msg) return { ...prev, [key]: msg };
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [def]
  );

  const setField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleBlur = (key: string) => {
    runValidation(key, formData[key]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields before submit
    const newErrors: Record<string, string> = {};
    for (const [key, field] of Object.entries(def.fields) as [
      string,
      FieldDef,
    ][]) {
      const msg = validateFieldValue(field, formData[key]);
      if (msg) newErrors[key] = msg;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const cleaned: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(def.fields) as [
      string,
      FieldDef,
    ][]) {
      const val = formData[key];
      if (val !== undefined && val !== "") {
        cleaned[key] = val;
      } else if (field.required && mode === "create") {
        // let server-side validation catch this
      }
    }
    if (def.status && formData[def.status.field] !== undefined) {
      cleaned[def.status.field] = formData[def.status.field];
    }
    onSubmit(cleaned);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(`/${def.key}`)}
          className="text-sm text-muted hover:text-heading focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-semibold text-heading">
          {mode === "create" ? `New ${def.label}` : `Edit ${def.label}`}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        {def.formView.sections.map((section) => (
          <Panel key={section.label} title={section.label}>
            <div className="space-y-4">
              {section.fields.map((fieldKey) => {
                const field = def.fields[fieldKey];
                if (!field) return null;
                return (
                  <FieldRenderer
                    key={fieldKey}
                    fieldKey={fieldKey}
                    field={field}
                    value={formData[fieldKey]}
                    onChange={(v) => setField(fieldKey, v)}
                    onBlur={() => handleBlur(fieldKey)}
                    error={errors[fieldKey]}
                    relationOptions={
                      field.type === "relation"
                        ? relationOptions[fieldKey] ?? []
                        : []
                    }
                  />
                );
              })}
            </div>
          </Panel>
        ))}

        {error ? (
          <p className="text-sm text-error-text">{error}</p>
        ) : null}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center rounded-xl bg-amber-400 px-6 py-3 font-semibold text-slate-950 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                {mode === "create" ? "Creating..." : "Saving..."}
              </>
            ) : (
              mode === "create" ? "Create" : "Save"
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/${def.key}`)}
            className="rounded-xl bg-surface px-6 py-3 font-semibold text-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldRenderer({
  fieldKey,
  field,
  value,
  onChange,
  onBlur,
  error,
  relationOptions,
}: {
  fieldKey: string;
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  onBlur: () => void;
  error?: string;
  relationOptions: { id: number; label: string }[];
}) {
  switch (field.type) {
    case "text":
      return (
        <TextField
          def={field}
          value={String(value ?? "")}
          onChange={onChange as (v: string) => void}
          onBlur={onBlur}
          error={error}
          fieldKey={fieldKey}
          required={field.required}
        />
      );
    case "number":
      return (
        <NumberField
          def={field}
          value={value === undefined || value === "" ? "" : Number(value)}
          onChange={onChange as (v: number | "") => void}
          onBlur={onBlur}
          error={error}
          fieldKey={fieldKey}
          required={field.required}
        />
      );
    case "date":
      return (
        <DateField
          def={field}
          value={String(value ?? "")}
          onChange={onChange as (v: string) => void}
          onBlur={onBlur}
          error={error}
          fieldKey={fieldKey}
          required={field.required}
        />
      );
    case "select":
      return (
        <SelectField
          def={field}
          value={String(value ?? "")}
          onChange={onChange as (v: string) => void}
          onBlur={onBlur}
          error={error}
          fieldKey={fieldKey}
          required={field.required}
        />
      );
    case "relation":
      return (
        <RelationField
          def={field}
          value={value === undefined || value === "" ? "" : Number(value)}
          onChange={onChange as (v: number | "") => void}
          onBlur={onBlur}
          error={error}
          options={relationOptions}
          fieldKey={fieldKey}
          required={field.required}
        />
      );
    case "file":
      return (
        <div>
          <label
            className="mb-1.5 block text-sm text-muted"
            htmlFor={`field-${fieldKey}`}
          >
            {field.label}
            {field.required && <span className="text-error-text ml-0.5">*</span>}
          </label>
          <p className="text-sm text-muted bg-surface-alt rounded-lg px-4 py-3 border border-border">
            ファイルアップロードは未実装です
          </p>
        </div>
      );
    default: {
      // Exhaustive check — all field types should be handled above
      const _exhaustive: never = field;
      return null;
    }
  }
}

function buildInitial(
  def: AnyRecordDef,
  existing?: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(def.fields) as [string, FieldDef][]) {
    if (existing && key in existing) {
      result[key] = existing[key];
    } else if ("defaultValue" in field && field.defaultValue !== undefined) {
      result[key] = field.defaultValue;
    } else {
      result[key] = "";
    }
  }
  if (def.status) {
    result[def.status.field] =
      existing?.[def.status.field] ?? def.status.defaultValue;
  }
  return result;
}
