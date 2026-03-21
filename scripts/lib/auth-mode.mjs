/**
 * Resolve auth mode from wrangler.jsonc vars.
 * Mirrors the runtime logic in src/lib/auth-mode.ts for use in CLI scripts.
 */
export function resolveScriptAuthMode(vars = {}) {
  if (vars.AUTH_MODE) {
    const mode = vars.AUTH_MODE.toLowerCase();
    if (mode === "none" || mode === "simple-admin" || mode === "better-auth") {
      return mode;
    }
  }
  // Backward compatibility: AUTH_ENABLED=false → none
  if (vars.AUTH_ENABLED === "false") return "none";
  return "better-auth";
}

/**
 * Return the list of Cloudflare secrets required for the resolved auth mode.
 */
export function requiredSecretsForAuthMode(vars = {}) {
  const mode = resolveScriptAuthMode(vars);
  if (mode === "better-auth") return ["BETTER_AUTH_SECRET"];
  if (mode === "simple-admin") return ["ADMIN_PASSWORD"];
  return [];
}
