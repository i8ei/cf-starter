const COLORS: Record<number, string> = {
  0: "bg-sky-400/15 text-sky-200",
  1: "bg-amber-400/15 text-amber-200",
  2: "bg-emerald-400/15 text-emerald-200",
  3: "bg-rose-400/15 text-rose-200",
  4: "bg-fuchsia-400/15 text-fuchsia-200",
  5: "bg-cyan-400/15 text-cyan-200",
};

export function StatusBadge({
  value,
  options,
}: {
  value: string;
  options: readonly string[];
}) {
  const idx = options.indexOf(value);
  const color = COLORS[idx >= 0 ? idx % Object.keys(COLORS).length : 0];
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${color}`}>
      {value}
    </span>
  );
}
