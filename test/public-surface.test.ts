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
});
