const FALLBACK_COLORS: string[] = [
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-800",
  "bg-rose-100 text-rose-800",
  "bg-fuchsia-100 text-fuchsia-800",
  "bg-cyan-100 text-cyan-800",
];

const statusColorMap: { pattern: RegExp; color: string }[] = [
  { pattern: /受付|\b(new|open|pending)\b/i, color: "bg-sky-100 text-sky-800" },
  {
    pattern: /進行|配車|\b(active|in.progress|processing)\b/i,
    color: "bg-amber-100 text-amber-800",
  },
  {
    pattern: /完了|\b(done|complete|closed|resolved)\b/i,
    color: "bg-emerald-100 text-emerald-800",
  },
  {
    pattern: /取消|\b(cancel|reject|error|fail)\b/i,
    color: "bg-rose-100 text-rose-800",
  },
  {
    pattern: /保留|\b(hold|pause|wait)\b/i,
    color: "bg-gray-100 text-gray-800",
  },
];

function getStatusColor(value: string, index: number): string {
  if (!value) return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  for (const entry of statusColorMap) {
    if (entry.pattern.test(value)) {
      return entry.color;
    }
  }
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function StatusBadge({
  value,
  options,
}: {
  value: string;
  options: readonly string[];
}) {
  const idx = options.indexOf(value);
  const color = getStatusColor(value, idx >= 0 ? idx : 0);
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${color}`}
    >
      {value}
    </span>
  );
}
