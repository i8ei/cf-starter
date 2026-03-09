import type { Env } from "../types";

export type ModuleStatus = {
  key: string;
  label: string;
  kind: "core" | "optional";
  enabled: boolean;
  required: string[];
  note: string;
};

export function getRuntimeModuleStatuses(env: Env): ModuleStatus[] {
  const emailProvider = env.EMAIL_PROVIDER?.toLowerCase() ?? "log";

  return [
    {
      key: "jobs",
      label: "Queue Jobs",
      kind: "core",
      enabled: !!env.JOBS,
      required: ["JOBS binding"],
      note: "core auth mail jobs and uploads",
    },
    {
      key: "rate_limiter",
      label: "Rate Limiter",
      kind: "core",
      enabled: !!env.RATE_LIMITER,
      required: ["RATE_LIMITER binding"],
      note: "auth rate limit",
    },
    {
      key: "kv",
      label: "KV Example",
      kind: "optional",
      enabled: !!env.KV,
      required: ["KV binding"],
      note: "example key-value feature",
    },
    {
      key: "upload",
      label: "R2 Upload Example",
      kind: "optional",
      enabled: !!env.BUCKET,
      required: ["BUCKET binding"],
      note: "example upload feature",
    },
    {
      key: "email_delivery",
      label: "Email Delivery",
      kind: "optional",
      enabled:
        emailProvider === "resend" &&
        !!env.RESEND_API_KEY &&
        !!env.EMAIL_FROM,
      required: ["EMAIL_PROVIDER=resend", "RESEND_API_KEY", "EMAIL_FROM"],
      note:
        emailProvider === "resend"
          ? "resend active"
          : "log fallback active",
    },
  ];
}
