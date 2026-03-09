import { describe, expect, it } from "vitest";
import { buildAppPlan } from "../scripts/lib/app-plan.mjs";
import { starterManifest } from "../scripts/lib/starter-manifest.mjs";

describe("starter manifest", () => {
  it("lists core paths and example features", () => {
    expect(starterManifest.core.backendPaths).toContain("src/index.ts");
    expect(starterManifest.core.sharedPaths).toContain("shared/schemas/auth.ts");
    expect(starterManifest.exampleFeatures.map((feature) => feature.key)).toEqual([
      "items",
      "kv",
      "upload",
    ]);
  });

  it("builds a machine-readable app plan", () => {
    const plan = buildAppPlan({ coreOnly: true });
    expect(plan.mode).toBe("core-only");
    expect(plan.exampleFeatures).toHaveLength(3);
    expect(plan.nextSteps[0]).toContain("Remove example feature routes");
  });
});
