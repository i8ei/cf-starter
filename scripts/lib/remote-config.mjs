function normalizeOrigin(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.origin !== trimmed) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isLocalOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  const { hostname } = new URL(normalized);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function parseCorsOrigins(raw) {
  if (typeof raw !== "string") return { origins: [], rejected: [] };
  const entries = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const origins = [];
  const rejected = [];
  for (const entry of entries) {
    const n = normalizeOrigin(entry);
    if (n) origins.push(n);
    else rejected.push(entry);
  }
  return { origins, rejected };
}

export function inspectRemoteWebConfig(vars = {}) {
  const appBaseUrl = normalizeOrigin(vars.APP_BASE_URL);
  const { origins: corsOrigins, rejected: corsRejected } = parseCorsOrigins(vars.CORS_ORIGIN);
  const hasHttpsAppBaseUrl = Boolean(appBaseUrl?.startsWith("https://"));
  const hasRemoteCorsOrigin = corsOrigins.some((origin) => !isLocalOrigin(origin));
  const appBaseUrlIncludedInCors = Boolean(
    appBaseUrl && corsOrigins.includes(appBaseUrl)
  );

  return {
    appBaseUrl,
    appBaseUrlIsConfigured: Boolean(appBaseUrl),
    appBaseUrlIsLocal: Boolean(appBaseUrl && isLocalOrigin(appBaseUrl)),
    appBaseUrlUsesHttps: hasHttpsAppBaseUrl,
    corsOrigins,
    corsRejected,
    hasRemoteCorsOrigin,
    appBaseUrlIncludedInCors,
  };
}
