export function StatusFilterTabs({
  options,
  current,
  onChange,
  counts,
}: {
  options: readonly string[];
  current: string | null;
  onChange: (value: string | null) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
          current === null
            ? "bg-amber-400 text-slate-950"
            : "bg-surface text-muted hover:bg-surface-hover"
        }`}
      >
        All{counts ? ` (${Object.values(counts).reduce((a, b) => a + b, 0)})` : ""}
      </button>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            current === opt
              ? "bg-amber-400 text-slate-950"
              : "bg-surface text-muted hover:bg-surface-hover"
          }`}
        >
          {opt}{counts?.[opt] !== undefined ? ` (${counts[opt]})` : ""}
        </button>
      ))}
    </div>
  );
}
