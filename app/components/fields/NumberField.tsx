import type { NumberField as NumberFieldDef } from "@shared/lib/record-def";

export function NumberField({
  def,
  value,
  onChange,
  error,
  fieldKey,
  required,
  onBlur,
}: {
  def: NumberFieldDef;
  value: number | "";
  onChange: (value: number | "") => void;
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
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? "" : Number(v));
        }}
        onBlur={onBlur}
        min={def.min}
        max={def.max}
        className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-amber-400"
        aria-required={required || undefined}
        aria-describedby={error && errorId ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
