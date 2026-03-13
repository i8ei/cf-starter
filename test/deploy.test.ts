import { describe, expect, it } from "vitest";
import { buildDeployPlan } from "../scripts/lib/deploy.mjs";

describe("buildDeployPlan", () => {
  it("builds a deploy plan with warnings for incomplete remote config", () => {
    const report = buildDeployPlan({
      packageJson: {
        name: "cf-starter",
        scripts: {
          build: "vite build",
        },
      },
      config: {
        name: "cf-starter",
        main: "./src/index.ts",
        d1_databases: [{ database_id: "TODO" }],
        vars: {
          EMAIL_FROM: "cf-starter <noreply@example.com>",
        },
      },
      pathStatuses: {
        "node_modules": true,
        "node_modules/.bin/wrangler": true,
      },
    });

    expect(report.ok).toBe(true);
    expect(report.command).toBe("deploy");
    expect(report.mode).toBe("plan");
    expect(report.target).toBe("remote");
    expect(report.changes).toEqual([
      { kind: "step", action: "run", label: "npm run build" },
      { kind: "step", action: "run", label: "wrangler deploy" },
    ]);
    expect(report.warnings).toContain(
      "Deploy may fail or be incomplete because d1_databases[0].database_id is not set."
    );
  });

  it("fails when the build script is missing", () => {
    const report = buildDeployPlan({
      packageJson: {
        scripts: {},
      },
      config: {},
      pathStatuses: {},
    });

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "build-script")?.level).toBe("fail");
  });
});
