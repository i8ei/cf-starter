import type { TextField as TextFieldDef } from "@shared/lib/record-def";

export function TextField({
  def,
  value,
  onChange,
  error,
}: {
  def: TextFieldDef;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const base =
    "w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus:border-amber-300/40";

  if (def.multiline) {
    return (
      <div>
        <label className="mb-1.5 block text-sm text-slate-300">{def.label}</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={def.maxLength}
          rows={3}
          className={base}
        />
        {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm text-slate-300">{def.label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={def.maxLength}
        className={base}
      />
      {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
