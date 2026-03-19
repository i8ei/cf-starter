import type { Env } from "../types";

export type AuthMode = "none" | "simple-admin" | "better-auth";

/**
 * Resolve the effective auth mode from environment variables.
 * Supports backward compatibility with AUTH_ENABLED.
 */
export function resolveAuthMode(env: Env): AuthMode {
  if (env.AUTH_MODE) {
    const mode = env.AUTH_MODE.toLowerCase();
    if (mode === "none" || mode === "simple-admin" || mode === "better-auth") {
      return mode;
    }
  }
  // Backward compatibility: AUTH_ENABLED=false → none
  if (env.AUTH_ENABLED === "false") return "none";
  return "better-auth";
}
