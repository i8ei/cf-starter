const FALLBACK = [
  "#2563eb", "#f97316", "#22c55e", "#a855f7", "#06b6d4",
  "#f43f5e", "#eab308", "#ec4899", "#14b8a6", "#6366f1",
];

let cached: string[] | null = null;

function resolve(): string[] {
  if (cached) return cached;
  if (typeof document === "undefined") return FALLBACK;
  const style = getComputedStyle(document.documentElement);
  const colors = Array.from({ length: 10 }, (_, i) => {
    const v = style.getPropertyValue(`--chart-${i + 1}`).trim();
    return v || FALLBACK[i];
  });
  cached = colors;
  return colors;
}

export function getChartColors(count?: number): string[] {
  const palette = resolve();
  if (!count) return palette;
  return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
}
