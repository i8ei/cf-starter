import type { SelectField as SelectFieldDef } from "@shared/lib/record-def";

export function SelectField({
  def,
  value,
  onChange,
  error,
}: {
  def: SelectFieldDef;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-slate-300">{def.label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-amber-300/40"
      >
        {!def.required ? <option value="">--</option> : null}
        {def.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
