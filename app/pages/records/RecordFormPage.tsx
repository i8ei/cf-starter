import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import type { RecordDef, FieldDef } from "@shared/lib/record-def";
import { Panel } from "~/components/Panel";
import {
  TextField,
  NumberField,
  DateField,
  SelectField,
  RelationField,
} from "~/components/fields";

type Props = {
  def: RecordDef;
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  error?: string | null;
  mode: "create" | "edit";
  relationOptions?: Record<string, { id: number; label: string }[]>;
};

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

  useEffect(() => {
    if (initialData) {
      setFormData(buildInitial(def, initialData));
    }
  }, [initialData, def]);

  const setField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(def.fields)) {
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
          className="text-sm text-slate-400 hover:text-white"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-semibold text-white">
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
          <p className="text-sm text-rose-300">{error}</p>
        ) : null}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl bg-amber-400 px-6 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            {mode === "create" ? "Create" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/${def.key}`)}
            className="rounded-2xl bg-white/5 px-6 py-3 font-semibold text-slate-300"
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
  relationOptions,
}: {
  fieldKey: string;
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  relationOptions: { id: number; label: string }[];
}) {
  switch (field.type) {
    case "text":
      return (
        <TextField
          def={field}
          value={String(value ?? "")}
          onChange={onChange as (v: string) => void}
        />
      );
    case "number":
      return (
        <NumberField
          def={field}
          value={value === undefined || value === "" ? "" : Number(value)}
          onChange={onChange as (v: number | "") => void}
        />
      );
    case "date":
      return (
        <DateField
          def={field}
          value={String(value ?? "")}
          onChange={onChange as (v: string) => void}
        />
      );
    case "select":
      return (
        <SelectField
          def={field}
          value={String(value ?? "")}
          onChange={onChange as (v: string) => void}
        />
      );
    case "relation":
      return (
        <RelationField
          def={field}
          value={value === undefined || value === "" ? "" : Number(value)}
          onChange={onChange as (v: number | "") => void}
          options={relationOptions}
        />
      );
    default:
      return (
        <div>
          <label className="mb-1.5 block text-sm text-slate-300">
            {field.label}
          </label>
          <input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
          />
        </div>
      );
  }
}

function buildInitial(
  def: RecordDef,
  existing?: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(def.fields)) {
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
