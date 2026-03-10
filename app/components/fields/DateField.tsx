import type { DateField as DateFieldDef } from "@shared/lib/record-def";

export function DateField({
  def,
  value,
  onChange,
  error,
}: {
  def: DateFieldDef;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm text-slate-300">{def.label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-amber-300/40"
      />
      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
