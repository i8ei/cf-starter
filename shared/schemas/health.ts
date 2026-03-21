export interface HealthResponse {
  status: "ok" | "degraded";
  checks: Record<string, string>;
  authEnabled: boolean;
  authMode: "none" | "simple-admin" | "better-auth";
}
