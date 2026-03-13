import { describe, expect, it } from "vitest";
import { buildEnvPlan } from "../scripts/lib/env-plan.mjs";

describe("buildEnvPlan", () => {
  it("builds a structured resource plan from wrangler config", () => {
    const report = buildEnvPlan({
      config: {
        d1_databases: [
          {
            binding: "DB",
            database_name: "cf-starter-db",
            database_id: "TODO",
          },
        ],
        kv_namespaces: [
          {
            binding: "KV",
            id: "123",
          },
        ],
        r2_buckets: [
          {
            binding: "BUCKET",
            bucket_name: "cf-starter-bucket",
          },
        ],
        durable_objects: {
          bindings: [
            {
              name: "RATE_LIMITER",
              class_name: "RateLimiter",
            },
          ],
        },
        queues: {
          producers: [
            {
              binding: "JOBS",
              queue: "cf-starter-jobs",
            },
          ],
        },
      },
    });

    expect(report.ok).toBe(true);
    expect(report.command).toBe("env plan");
    expect(report.target).toBe("config");
    expect(report.changes.some((change) => change.kind === "resource" && change.resourceType === "d1")).toBe(true);
    expect(report.changes.some((change) => change.kind === "binding" && change.field === "database_id" && change.status === "missing")).toBe(true);
    expect(report.warnings).toContain("1 binding value(s) still need to be filled in.");
  });
});
