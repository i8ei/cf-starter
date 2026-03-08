const DEFAULT_ORIGINS = ["http://localhost:5173"];

export function resolveCorsOrigins(raw?: string): string[] {
  if (!raw) return DEFAULT_ORIGINS;
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : DEFAULT_ORIGINS;
}
