import { describe, expect, it } from "vitest";
import { buildModulesPlan } from "../scripts/lib/modules-plan.mjs";
import { getRuntimeModuleStatuses } from "../src/lib/module-plan";
import { createTestEnv } from "./helpers";

describe("module plan", () => {
  it("reports optional and core module statuses", () => {
    const modules = getRuntimeModuleStatuses(
      createTestEnv({
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "Starter <noreply@example.com>",
        RESEND_API_KEY: "re_test",
      })
    );

    expect(modules.find((item) => item.key === "jobs")?.enabled).toBe(true);
    expect(modules.find((item) => item.key === "kv")?.kind).toBe("optional");
    expect(modules.find((item) => item.key === "email_delivery")?.enabled).toBe(
      true
    );
  });

  it("builds a machine-readable cli plan from wrangler-like config", () => {
    const plan = buildModulesPlan(
      {
        queues: { producers: [{ binding: "JOBS" }] },
        durable_objects: { bindings: [{ name: "RATE_LIMITER" }] },
        kv_namespaces: [{ binding: "KV" }],
        r2_buckets: [{ binding: "BUCKET" }],
        vars: {
          EMAIL_PROVIDER: "resend",
          EMAIL_FROM: "Starter <noreply@example.com>",
        },
      },
      { RESEND_API_KEY: "re_test" }
    );

    expect(plan.modules.find((item) => item.key === "jobs")?.enabled).toBe(true);
    expect(plan.modules.find((item) => item.key === "upload")?.enabled).toBe(true);
    expect(plan.modules.find((item) => item.key === "email_delivery")?.enabled).toBe(
      true
    );
  });
});
