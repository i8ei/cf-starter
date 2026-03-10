import type { RelationField as RelationFieldDef } from "@shared/lib/record-def";

export function RelationField({
  def,
  value,
  onChange,
  options,
  error,
}: {
  def: RelationFieldDef;
  value: number | "";
  onChange: (value: number | "") => void;
  options: { id: number; label: string }[];
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-slate-300">{def.label}</label>
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? "" : Number(v));
        }}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-amber-300/40"
      >
        {!def.required ? <option value="">--</option> : null}
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
