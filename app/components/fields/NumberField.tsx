import type { NumberField as NumberFieldDef } from "@shared/lib/record-def";

export function NumberField({
  def,
  value,
  onChange,
  error,
}: {
  def: NumberFieldDef;
  value: number | "";
  onChange: (value: number | "") => void;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-slate-300">{def.label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? "" : Number(v));
        }}
        min={def.min}
        max={def.max}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-amber-300/40"
      />
      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
