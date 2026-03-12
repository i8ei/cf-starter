import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("public surface", () => {
  it("does not expose deprecated app planning scripts in package.json", async () => {
    const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts).not.toHaveProperty("modules:plan");
    expect(packageJson.scripts).not.toHaveProperty("modules:plan:json");
    expect(packageJson.scripts).not.toHaveProperty("app:plan");
    expect(packageJson.scripts).not.toHaveProperty("app:plan:core");
    expect(packageJson.scripts).not.toHaveProperty("app:plan:json");
    expect(packageJson.scripts).not.toHaveProperty("app:plan:core:json");
    expect(packageJson.scripts).not.toHaveProperty("app:scaffold");
  });

  it("documents create-cf-starter as the primary flow", async () => {
    const readme = await readFile(join(repoRoot, "README.md"), "utf8");

    expect(readme).toContain("npx . regional-ops");
    expect(readme).toContain("npx . regional-ops --include items");
    expect(readme).toContain("npx . regional-ops --starter");
    expect(readme).toContain("互換ショートカット");
    expect(readme).toContain("scripts/compat/");
    expect(readme).not.toContain("npm run app:scaffold");
    expect(readme).not.toContain("npm run app:plan");
    expect(readme).not.toContain("npm run modules:plan");
  });

  it("publishes only scaffold runtime files and generated-app assets", () => {
    const packOutput = execFileSync("npm", ["pack", "--json", "--dry-run"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const [{ files }] = JSON.parse(packOutput) as [{ files: Array<{ path: string }> }];
    const packedPaths = new Set(files.map((file) => file.path));

    expect(packedPaths).toContain(".github/workflows/ci.yml");
    expect(packedPaths).not.toContain("ARCHITECTURE.md");
    expect(packedPaths).not.toContain("ROADMAP.md");
    expect(packedPaths).not.toContain("scripts/check-publish-ready.mjs");
    expect(packedPaths).not.toContain("scripts/test-create.mjs");
    expect(packedPaths).not.toContain("scripts/compat/app-plan.mjs");
    expect(packedPaths).not.toContain("scripts/compat/modules-plan.mjs");
    expect(packedPaths).not.toContain("scripts/compat/scaffold-app.mjs");
    expect(packedPaths).not.toContain("scripts/internal/app-plan.mjs");
    expect(packedPaths).not.toContain("scripts/internal/modules-plan.mjs");
    expect(packedPaths).not.toContain("scripts/lib/app-plan.mjs");
    expect(packedPaths).not.toContain("scripts/lib/modules-plan.mjs");
    expect(packedPaths).not.toContain("test/create-cf-starter.test.ts");
    expect(packedPaths).not.toContain("test/deprecated-cli.test.ts");
    expect(packedPaths).not.toContain("test/doctor.test.ts");
    expect(packedPaths).not.toContain("test/module-plan.test.ts");
    expect(packedPaths).not.toContain("test/public-surface.test.ts");
    expect(packedPaths).not.toContain("test/scaffold.test.ts");
    expect(packedPaths).not.toContain("test/starter-manifest.test.ts");
  });
});
