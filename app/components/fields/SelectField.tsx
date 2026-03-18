import type { SelectField as SelectFieldDef } from "@shared/lib/record-def";

export function SelectField({
  def,
  value,
  onChange,
  error,
  fieldKey,
  required,
  onBlur,
}: {
  def: SelectFieldDef;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  fieldKey?: string;
  required?: boolean;
  onBlur?: () => void;
}) {
  const id = fieldKey ? `field-${fieldKey}` : undefined;
  const errorId = fieldKey ? `field-${fieldKey}-error` : undefined;

  return (
    <div>
      <label className="mb-1.5 block text-sm text-muted" htmlFor={id}>
        {def.label}
        {required && <span className="text-error-text ml-0.5">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-amber-400"
        aria-required={required || undefined}
        aria-describedby={error && errorId ? errorId : undefined}
      >
        {!def.required ? <option value="">--</option> : null}
        {def.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-error-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
