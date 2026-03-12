import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyCoreOnlyTransforms,
  applyFeatureSelection,
  buildScaffoldPlan,
  buildScaffoldSummary,
  resolveSelectedFeatures,
  validateProjectName,
  rewriteScaffoldMetadata,
  rewriteIndexForCoreOnly,
  scaffoldStarter,
  writeCoreOnlyApp,
} from "../scripts/lib/scaffold.mjs";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("scaffold", () => {
  it("keeps legacy line-based index fixtures working in core-only mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-index-"));
    tempDirs.push(dir);
    const indexPath = join(dir, "index.ts");

    await writeFile(
      indexPath,
      [
        'import items from "../examples/feature-packs/items/server/routes";',
        'import kv from "../examples/feature-packs/kv/server/routes";',
        'import upload from "../examples/feature-packs/upload/server/routes";',
        'app.route("/api/items", items)',
        'app.route("/api/kv", kv)',
        'app.route("/api/upload", upload)',
        'app.route("/api/auth", auth)',
      ].join("\n")
    );

    await rewriteIndexForCoreOnly(indexPath);
    const updated = await readFile(indexPath, "utf8");

    expect(updated).not.toContain("/api/items");
    expect(updated).not.toContain("/api/kv");
    expect(updated).not.toContain("/api/upload");
    expect(updated).toContain("/api/auth");
  });

  it("rewrites marker-based feature blocks in index for core-only mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-index-markers-"));
    tempDirs.push(dir);
    const indexPath = join(dir, "index.ts");

    await writeFile(
      indexPath,
      [
        '// scaffold:feature-import:start items',
        'import items from "../examples/feature-packs/items/server/routes";',
        '// scaffold:feature-import:end items',
        '// scaffold:feature-import:start kv',
        'import kv from "../examples/feature-packs/kv/server/routes";',
        '// scaffold:feature-import:end kv',
        'app',
        '// scaffold:feature-route:start items',
        '  .route("/api/items", items)',
        '// scaffold:feature-route:end items',
        '// scaffold:feature-route:start kv',
        '  .route("/api/kv", kv)',
        '// scaffold:feature-route:end kv',
        '  .route("/api/auth", auth)',
      ].join("\n")
    );

    await rewriteIndexForCoreOnly(indexPath);
    const updated = await readFile(indexPath, "utf8");

    expect(updated).not.toContain('scaffold:feature-import:start items');
    expect(updated).not.toContain("/api/items");
    expect(updated).not.toContain("/api/kv");
    expect(updated).toContain("/api/auth");
  });

  it("rewrites the source index template through marker-based core-only transform", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-index-template-"));
    tempDirs.push(dir);
    const indexPath = join(dir, "index.ts");

    await writeFile(indexPath, await readFile(join(process.cwd(), "src/index.ts"), "utf8"));

    await rewriteIndexForCoreOnly(indexPath);
    const updated = await readFile(indexPath, "utf8");

    expect(updated).toContain('.route("/api/auth", auth)');
    expect(updated).toContain('.route("/api/orgs", orgs)');
    expect(updated).not.toContain("scaffold:feature-import:start");
    expect(updated).not.toContain("scaffold:feature-route:start");
  });

  it("applies core-only transforms to a copied app", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-core-only-"));
    tempDirs.push(dir);

    await mkdir(join(dir, "examples/feature-packs/items/server"), { recursive: true });
    await mkdir(join(dir, "examples/feature-packs/items/app/hooks"), { recursive: true });
    await mkdir(join(dir, "examples/feature-packs/items/shared"), { recursive: true });
    await mkdir(join(dir, "src"), { recursive: true });
    await mkdir(join(dir, "src/db"), { recursive: true });
    await mkdir(join(dir, "app/pages"), { recursive: true });
    await mkdir(join(dir, "migrations"), { recursive: true });
    await writeFile(join(dir, "src/index.ts"), 'import items from "../examples/feature-packs/items/server/routes";\napp.route("/api/items", items)\napp.route("/api/auth", auth)');
    await writeFile(join(dir, "src/db/schema.ts"), 'export const organizations = {};\n// scaffold:items-schema:start\nexport { items } from "../../examples/feature-packs/items/server/db-schema";\n// scaffold:items-schema:end\n');
    await writeFile(join(dir, "app/App.tsx"), "old app");
    await writeFile(join(dir, "app/pages/HomePage.tsx"), "export function HomePage() {}");
    await writeFile(join(dir, "migrations/0010_example_items.sql"), "-- items\n");

    await applyCoreOnlyTransforms(dir);
    await writeCoreOnlyApp(dir, "starter-core");

    const appSource = await readFile(join(dir, "app/App.tsx"), "utf8");
    const indexSource = await readFile(join(dir, "src/index.ts"), "utf8");
    const dbSchemaSource = await readFile(join(dir, "src/db/schema.ts"), "utf8");

    expect(appSource).toContain("Record Engine");
    expect(appSource).toContain("recordNavItems");
    expect(appSource).not.toContain("HomePage");
    expect(indexSource).not.toContain("/api/items");
    expect(dbSchemaSource).not.toContain("db-schema");

    // HomePage.tsx should be removed
    await expect(readFile(join(dir, "app/pages/HomePage.tsx"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(join(dir, "migrations/0010_example_items.sql"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps marker contracts in source templates for scaffold transforms", async () => {
    const indexTemplate = await readFile(join(process.cwd(), "src/index.ts"), "utf8");
    const appTemplate = await readFile(join(process.cwd(), "app/App.tsx"), "utf8");
    const homePageTemplate = await readFile(join(process.cwd(), "app/pages/HomePage.tsx"), "utf8");
    const schemaTemplate = await readFile(join(process.cwd(), "src/db/schema.ts"), "utf8");

    expect(indexTemplate).toContain("// scaffold:feature-import:start items");
    expect(indexTemplate).toContain("// scaffold:feature-route:start upload");
    expect(appTemplate).toContain("// scaffold:items-import:start");
    expect(appTemplate).toContain("{/* scaffold:items-panel:start */}");
    expect(homePageTemplate).toContain("// scaffold:items-home-import:start");
    expect(homePageTemplate).toContain("// scaffold:items-home-hooks:start");
    expect(schemaTemplate).toContain("// scaffold:items-schema:start");
  });

  it("supports partial fixture sources without copying node_modules", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-source-"));
    const targetDir = await mkdtemp(join(tmpdir(), "cf-starter-target-parent-"));
    const target = join(targetDir, "generated");
    tempDirs.push(sourceDir, targetDir);

    await mkdir(join(sourceDir, "src"), { recursive: true });
    await mkdir(join(sourceDir, "node_modules/pkg"), { recursive: true });
    await mkdir(join(sourceDir, "template/app"), { recursive: true });
    await writeFile(join(sourceDir, "src/index.ts"), "export const ok = true;");
    await writeFile(join(sourceDir, "node_modules/pkg/index.js"), "ignored");
    await writeFile(join(sourceDir, "template/app/App.tsx"), "ignored template");
    await writeFile(join(sourceDir, "package-lock.json"), "{}\n");

    await scaffoldStarter({ sourceDir, targetDir: target });

    const copied = await readFile(join(target, "src/index.ts"), "utf8");
    expect(copied).toContain("ok = true");
    await expect(readFile(join(target, "node_modules/pkg/index.js"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(join(target, "template/app/App.tsx"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(join(target, "package-lock.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("scaffolds from the checked-in template layout by default", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "cf-starter-template-layout-"));
    const target = join(targetParent, "regional-ops");
    tempDirs.push(targetParent);

    await scaffoldStarter({
      sourceDir: process.cwd(),
      targetDir: target,
      appName: "regional-ops",
      include: ["upload"],
    });

    expect(await readFile(join(target, "package.json"), "utf8")).toContain('"name": "regional-ops"');
    expect(await readFile(join(target, "README.md"), "utf8")).toContain("# regional-ops");
    expect(await readFile(join(target, "scripts/doctor.mjs"), "utf8")).toContain("#!/usr/bin/env node");
    expect(await readFile(join(target, "examples/feature-packs/upload/server/routes.ts"), "utf8")).toContain(
      'type: "upload.process"'
    );
    await expect(readFile(join(target, "examples/feature-packs/items/server/routes.ts"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(join(target, "bin/create-cf-starter"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("scaffolds a core-only app from the checked-in template layout", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "cf-starter-template-core-only-"));
    const target = join(targetParent, "regional-ops");
    tempDirs.push(targetParent);

    await scaffoldStarter({
      sourceDir: process.cwd(),
      targetDir: target,
      appName: "regional-ops",
      coreOnly: true,
    });

    expect(await readFile(join(target, "package.json"), "utf8")).toContain('"name": "regional-ops"');
    expect(await readFile(join(target, "app/App.tsx"), "utf8")).toContain("Record Engine");
    await expect(readFile(join(target, "examples/feature-packs/items/server/routes.ts"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(join(target, "app/pages/HomePage.tsx"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects the removed repo-copy compatibility flag on the internal scaffold CLI", async () => {
    const targetParent = await mkdtemp(join(tmpdir(), "cf-starter-internal-repo-copy-layout-"));
    const target = join(targetParent, "regional-ops");
    tempDirs.push(targetParent);

    const result = spawnSync(
      process.execPath,
      [
        "scripts/internal/scaffold-app.mjs",
        "--source-dir",
        process.cwd(),
        "--target",
        target,
        "--include",
        "upload",
        "--repo-copy-layout",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--repo-copy-layout is no longer supported.");
  });

  it("passes selected features through scaffold metadata rewrites", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-source-meta-"));
    const targetDir = await mkdtemp(join(tmpdir(), "cf-starter-target-meta-parent-"));
    const target = join(targetDir, "generated");
    tempDirs.push(sourceDir, targetDir);

    await mkdir(join(sourceDir, "app"), { recursive: true });
    await mkdir(join(sourceDir, "src"), { recursive: true });
    await writeFile(join(sourceDir, "package.json"), JSON.stringify({ name: "cf-starter" }, null, 2));
    await writeFile(
      join(sourceDir, "wrangler.jsonc"),
      [
        '{',
        '  "name": "cf-starter",',
        '  "kv_namespaces": [{ "binding": "KV", "id": "TODO" }],',
        '  "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "cf-starter-bucket" }],',
        '  "d1_databases": [{ "database_name": "cf-starter-db" }],',
        '  "queues": { "producers": [{ "queue": "cf-starter-jobs" }], "consumers": [{ "queue": "cf-starter-jobs" }] },',
        '  "vars": { "EMAIL_FROM": "cf-starter <noreply@example.com>" }',
        '}',
      ].join("\n")
    );
    await writeFile(
      join(sourceDir, "README.md"),
      [
        "# cf-starter",
        "",
        "## ディレクトリ構成",
        "",
        "```text",
        "cf-starter/",
        "├── app/                    React UI",
        "│   ├── hooks/              core hooks",
        "│   └── lib/api.ts          型付き Hono RPC client",
        "├── examples/               selected example feature packs",
        "│   ├── feature-packs/      app / shared / server example code",
        "├── shared/                 フロント・バック共有契約",
        "│   └── schemas/            core schema",
        "├── src/                    Worker backend",
        "│   ├── db/                 Drizzle schema",
        "│   ├── durable-objects/    rate limiter",
        "│   ├── lib/                auth, session, audit, organizations など",
        "│   ├── middleware/         auth, csrf, role, request-id",
        "│   ├── queues/             queue producer / consumer",
        "│   ├── routes/             core API routes",
        "│   └── index.ts            Worker entrypoint",
        "├── migrations/             D1 migrations",
        "├── scripts/                補助スクリプト",
        "├── test/                   unit / integration tests",
        "├── ARCHITECTURE.md",
        "├── ROADMAP.md",
        "└── README.md",
        "```",
        "",
        "## Core API",
      ].join("\n")
    );
    await writeFile(join(sourceDir, "app/App.tsx"), "cf-starter\nStarter Core\n");
    await writeFile(join(sourceDir, "src/index.ts"), 'import kv from "../examples/feature-packs/kv/server/routes";\napp.route("/api/kv", kv)');

    await scaffoldStarter({
      sourceDir,
      targetDir: target,
      appName: "regional-ops",
      include: ["kv"],
    });

    const readme = await readFile(join(target, "README.md"), "utf8");
    expect(readme).toContain("# regional-ops");
    expect(readme).toContain("npm install");
  });

  it("rewrites package, wrangler, readme, and app metadata for the target app name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-meta-"));
    tempDirs.push(dir);

    await mkdir(join(dir, "app"), { recursive: true });
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({
        name: "cf-starter",
        scripts: {
          dev: "vite dev",
          test: "vitest run",
          "check:publish": "node scripts/check-publish-ready.mjs",
          "test:create": "node scripts/test-create.mjs",
          "modules:plan": "node scripts/modules-plan.mjs",
          "modules:plan:json": "node scripts/modules-plan.mjs --json",
          "app:plan": "node scripts/app-plan.mjs",
          "app:plan:core": "node scripts/app-plan.mjs --core-only",
          "app:plan:json": "node scripts/app-plan.mjs --json",
          "app:plan:core:json": "node scripts/app-plan.mjs --core-only --json",
          "app:scaffold": "node scripts/scaffold-app.mjs",
        },
      }, null, 2)
    );
    await writeFile(
      join(dir, "wrangler.jsonc"),
      [
        '{',
        '  "name": "cf-starter",',
        '  "d1_databases": [{ "database_name": "cf-starter-db" }],',
        '  "r2_buckets": [{ "bucket_name": "cf-starter-bucket" }],',
        '  "queues": { "producers": [{ "queue": "cf-starter-jobs" }], "consumers": [{ "queue": "cf-starter-jobs" }] },',
        '  "vars": { "EMAIL_FROM": "cf-starter <noreply@example.com>" }',
        '}',
      ].join("\n")
    );
    await writeFile(
      join(dir, "README.md"),
      [
        "# cf-starter",
        "",
        "`cf-starter`",
        "cf-starter/",
        "",
        "このリポジトリは 2 層で考えます。",
        "",
        "- Starter Core: 認証、セッション、権限、organization context、API 契約、DB、ログ、テスト、Cloudflare bindings",
        "- Example Features: `items`、`kv`、`upload` のような最小サンプル",
        "",
        "### Cloudflare へデプロイ",
        "",
        "```bash",
        "# 1. リソース作成",
        "wrangler d1 create my-app-db",
        "wrangler kv namespace create KV",
        "wrangler r2 bucket create my-app-bucket",
        "wrangler queues create my-app-jobs",
        "```",
        "",
        "## Example Feature API",
        "",
        "| エンドポイント | 内容 |",
        "|---|---|",
        "| `GET /api/items` | current organization の item 一覧 |",
        "",
        "## Security Invariants",
      ].join("\n")
    );
    await writeFile(join(dir, "app/App.tsx"), "cf-starter\nStarter Core\n");

    await rewriteScaffoldMetadata(dir, "regional-ops", {
      coreOnly: true,
      selectedFeatures: [],
      requiredBindings: ["DB", "JOBS", "RATE_LIMITER"],
    });

    const pkgJson = await readFile(join(dir, "package.json"), "utf8");
    expect(pkgJson).toContain('"name": "regional-ops"');
    expect(pkgJson).toContain('"private": true');
    expect(pkgJson).not.toContain('"bin"');
    expect(pkgJson).not.toContain('"publishConfig"');
    expect(pkgJson).toContain('"dev"');
    expect(pkgJson).toContain('"test"');
    expect(pkgJson).toContain('"doctor"');
    expect(pkgJson).toContain('"seed:demo"');
    expect(pkgJson).not.toContain('"check:publish"');
    expect(pkgJson).not.toContain('"test:create"');
    expect(pkgJson).not.toContain('"modules:plan"');
    expect(pkgJson).not.toContain('"app:plan"');
    expect(pkgJson).not.toContain('"app:scaffold"');
    expect(await readFile(join(dir, "wrangler.jsonc"), "utf8")).toContain('"name": "regional-ops"');
    expect(await readFile(join(dir, "wrangler.jsonc"), "utf8")).toContain('"database_name": "regional-ops-db"');
    expect(await readFile(join(dir, "wrangler.jsonc"), "utf8")).not.toContain('"kv_namespaces"');
    expect(await readFile(join(dir, "wrangler.jsonc"), "utf8")).not.toContain('"r2_buckets"');
    expect(await readFile(join(dir, "README.md"), "utf8")).toContain("# regional-ops");
    expect(await readFile(join(dir, "README.md"), "utf8")).toContain("npm install");
    expect(await readFile(join(dir, "README.md"), "utf8")).toContain("npm run seed:demo");
    expect(await readFile(join(dir, "README.md"), "utf8")).not.toContain("create-cf-starter");
    expect(await readFile(join(dir, "README.md"), "utf8")).not.toContain("wrangler kv namespace create KV");
    expect(await readFile(join(dir, "README.md"), "utf8")).not.toContain("| Storage | R2 |");
    expect(await readFile(join(dir, "README.md"), "utf8")).not.toContain("| Cache | KV |");
    expect(await readFile(join(dir, "app/App.tsx"), "utf8")).toContain("regional-ops");
  });

  it("strips scaffold markers from generated app files", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-source-markers-"));
    const targetDir = await mkdtemp(join(tmpdir(), "cf-starter-target-markers-parent-"));
    const target = join(targetDir, "generated");
    tempDirs.push(sourceDir, targetDir);

    await mkdir(join(sourceDir, "app/pages"), { recursive: true });
    await mkdir(join(sourceDir, "src/db"), { recursive: true });
    await writeFile(
      join(sourceDir, "package.json"),
      JSON.stringify(
        {
          name: "cf-starter",
          scripts: {},
        },
        null,
        2
      )
    );
    await writeFile(
      join(sourceDir, "wrangler.jsonc"),
      [
        "{",
        '  "name": "cf-starter",',
        '  "d1_databases": [{ "binding": "DB", "database_name": "cf-starter-db" }],',
        '  "queues": { "producers": [{ "queue": "cf-starter-jobs" }], "consumers": [{ "queue": "cf-starter-jobs" }] },',
        '  "vars": { "EMAIL_FROM": "cf-starter <noreply@example.com>" }',
        "}",
      ].join("\n")
    );
    await writeFile(join(sourceDir, "README.md"), "# cf-starter\n");
    await writeFile(
      join(sourceDir, "src/index.ts"),
      [
        "// scaffold:feature-import:start items",
        "// scaffold:feature-import:end items",
        "export const app = createApp()",
        "  // scaffold:feature-route:start items",
        "  // scaffold:feature-route:end items",
        '  .route("/api/auth", auth);',
      ].join("\n")
    );
    await writeFile(
      join(sourceDir, "app/App.tsx"),
      [
        "export default function App() {",
        "  // scaffold:items-state:start",
        "  // scaffold:items-state:end",
        "  return (",
        "    <>",
        "      {/* scaffold:items-panel:start */}",
        "      {/* scaffold:items-panel:end */}",
        "      <div>cf-starter</div>",
        "    </>",
        "  );",
        "}",
      ].join("\n")
    );
    await writeFile(
      join(sourceDir, "app/pages/HomePage.tsx"),
      [
        "// scaffold:items-home-import:start",
        "// scaffold:items-home-import:end",
        "export function HomePage() {",
        "  // scaffold:items-home-hooks:start",
        "  // scaffold:items-home-hooks:end",
        "  return <div>home</div>;",
        "}",
      ].join("\n")
    );
    await writeFile(
      join(sourceDir, "src/db/schema.ts"),
      [
        "export const organizations = {};",
        "// scaffold:items-schema:start",
        "// scaffold:items-schema:end",
      ].join("\n")
    );

    await scaffoldStarter({ sourceDir, targetDir: target });

    for (const relativePath of [
      "src/index.ts",
      "app/App.tsx",
      "app/pages/HomePage.tsx",
      "src/db/schema.ts",
    ]) {
      const source = await readFile(join(target, relativePath), "utf8");
      expect(source).not.toContain("scaffold:");
    }
  });

  it("rewrites wrangler metadata based on parsed current values while preserving comments", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-wrangler-structured-"));
    tempDirs.push(dir);

    await mkdir(join(dir, "app"), { recursive: true });
    await writeFile(join(dir, "package.json"), JSON.stringify({ name: "cf-starter" }, null, 2));
    await writeFile(
      join(dir, "wrangler.jsonc"),
      [
        "{",
        '  "name": "ops-template",',
        '  // KV stays commented until needed',
        '  "d1_databases": [{ "database_name": "ops-template-main" }],',
        '  "r2_buckets": [{ "bucket_name": "ops-template-files" }],',
        '  "queues": { "producers": [{ "queue": "ops-template-queue" }], "consumers": [{ "queue": "ops-template-queue" }] },',
        '  "vars": { "EMAIL_FROM": "ops-template <hello@example.com>" }',
        "}",
      ].join("\n")
    );
    await writeFile(join(dir, "README.md"), "# cf-starter\n");
    await writeFile(join(dir, "app/App.tsx"), "cf-starter\nStarter Core\n");

    await rewriteScaffoldMetadata(dir, "regional-ops", {
      coreOnly: false,
      selectedFeatures: ["upload"],
      requiredBindings: ["DB", "JOBS", "RATE_LIMITER", "BUCKET"],
    });

    const wrangler = await readFile(join(dir, "wrangler.jsonc"), "utf8");
    expect(wrangler).toContain('"name": "regional-ops"');
    expect(wrangler).toContain('"database_name": "regional-ops-db"');
    expect(wrangler).toContain('"bucket_name": "regional-ops-bucket"');
    expect(wrangler).toContain('"queue": "regional-ops-jobs"');
    expect(wrangler).toContain('"EMAIL_FROM": "regional-ops <noreply@example.com>"');
    expect(wrangler).toContain("// KV stays commented until needed");
  });

  it("removes starter-only files and rewrites CI for generated apps", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-clean-source-"));
    const targetParent = await mkdtemp(join(tmpdir(), "cf-starter-clean-target-"));
    const targetDir = join(targetParent, "generated-app");
    tempDirs.push(sourceDir, targetParent);

    await mkdir(join(sourceDir, "app"), { recursive: true });
    await mkdir(join(sourceDir, "src"), { recursive: true });
    await mkdir(join(sourceDir, "scripts/lib"), { recursive: true });
    await mkdir(join(sourceDir, "scripts/internal"), { recursive: true });
    await mkdir(join(sourceDir, "scripts/lib/scaffold/renderers"), { recursive: true });
    await mkdir(join(sourceDir, "scripts/lib/scaffold/transforms"), { recursive: true });
    await mkdir(join(sourceDir, "test"), { recursive: true });
    await mkdir(join(sourceDir, ".claude"), { recursive: true });
    await mkdir(join(sourceDir, ".github/workflows"), { recursive: true });
    await writeFile(join(sourceDir, "package.json"), JSON.stringify({ name: "cf-starter" }, null, 2));
    await writeFile(join(sourceDir, "wrangler.jsonc"), '{ "name": "cf-starter", "d1_databases": [{ "database_name": "cf-starter-db" }] }\n');
    await writeFile(join(sourceDir, "README.md"), "# cf-starter\n\n### 新しい app を切る\n\nnode scripts/create-cf-starter.mjs my-app\n\n### Cloudflare へデプロイ\n");
    await writeFile(join(sourceDir, "app/App.tsx"), "cf-starter\nStarter Core\n");
    await writeFile(join(sourceDir, "src/index.ts"), 'app.route("/api/auth", auth)\n');
    await writeFile(join(sourceDir, "CLAUDE.md"), "# starter claude\n");
    await writeFile(join(sourceDir, ".claude/settings.local.json"), "{}\n");
    await writeFile(join(sourceDir, "ARCHITECTURE.md"), "# starter architecture\n");
    await writeFile(join(sourceDir, "ROADMAP.md"), "# starter roadmap\n");
    await writeFile(join(sourceDir, "scripts/create-cf-starter.mjs"), "console.log('starter');\n");
    await mkdir(join(sourceDir, "scripts/compat"), { recursive: true });
    await writeFile(join(sourceDir, "scripts/compat/scaffold-app.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/compat/modules-plan.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/compat/app-plan.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/check-publish-ready.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/test-create.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/internal/app-plan.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/internal/check-template-directory.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/internal/materialize-template-candidate.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/internal/modules-plan.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/internal/scaffold-app.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/internal/snapshot-template.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/internal/sync-template-directory.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/orchestrator.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/planner.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/renderers/app-template.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/renderers/readme.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/renderers/workflow.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/cleanup.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/app-metadata.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/file-ops.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/feature-selection.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/helpers.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/index-selection.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/items-selection.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/jsonc.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/metadata.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/package-metadata.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/readme-metadata.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/scaffold-markers.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/wrangler.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/scaffold/transforms/wrangler-metadata.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/modules-plan.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/deprecation.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/app-plan.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/starter-catalog.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/starter-manifest.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/template-candidate.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/template-directory.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/template-snapshot.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "scripts/lib/template-manifest.mjs"), "export const starter = true;\n");
    await writeFile(join(sourceDir, "test/create-cf-starter.test.ts"), "test('starter', () => {})\n");
    await writeFile(join(sourceDir, "test/deprecated-cli.test.ts"), "test('starter', () => {})\n");
    await writeFile(join(sourceDir, "test/doctor.test.ts"), "test('starter', () => {})\n");
    await writeFile(join(sourceDir, "test/public-surface.test.ts"), "test('starter', () => {})\n");
    await writeFile(join(sourceDir, "test/scaffold.test.ts"), "test('starter', () => {})\n");
    await writeFile(join(sourceDir, "test/module-plan.test.ts"), "test('starter', () => {})\n");
    await writeFile(join(sourceDir, "test/starter-manifest.test.ts"), "test('starter', () => {})\n");
    await writeFile(
      join(sourceDir, ".github/workflows/ci.yml"),
      [
        "name: CI",
        "jobs:",
        "  test-and-build:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - name: Check publish readiness",
        "        run: npm run check:publish",
        "      - name: Scaffold integration test",
        "        run: npm run test:create",
        "        timeout-minutes: 10",
        "      - name: Build",
        "        run: npm run build",
      ].join("\n")
    );

    await scaffoldStarter({
      sourceDir,
      targetDir,
      appName: "generated-app",
    });

    await expect(readFile(join(targetDir, "CLAUDE.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, ".claude/settings.local.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "ARCHITECTURE.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "ROADMAP.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/create-cf-starter.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/compat/scaffold-app.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/internal/check-template-directory.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/internal/materialize-template-candidate.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/internal/scaffold-app.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/internal/snapshot-template.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/internal/sync-template-directory.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/orchestrator.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/planner.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/renderers/app-template.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/transforms/app-metadata.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/transforms/file-ops.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/transforms/index-selection.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/transforms/items-selection.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/transforms/jsonc.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/transforms/metadata.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/transforms/package-metadata.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/transforms/readme-metadata.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/transforms/scaffold-markers.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/transforms/wrangler.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/scaffold/transforms/wrangler-metadata.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/template-candidate.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/deprecation.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/template-directory.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/template-snapshot.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "scripts/lib/template-manifest.mjs"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "test/create-cf-starter.test.ts"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "test/deprecated-cli.test.ts"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "test/public-surface.test.ts"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(targetDir, "test/scaffold.test.ts"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });

    const workflow = await readFile(join(targetDir, ".github/workflows/ci.yml"), "utf8");
    expect(workflow).not.toContain("check:publish");
    expect(workflow).not.toContain("test:create");
    expect(workflow).toContain("npm run build");
  });

  it("materializes selected example migrations into the generated app", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-migrations-source-"));
    const targetParent = await mkdtemp(join(tmpdir(), "cf-starter-migrations-target-"));
    const targetDir = join(targetParent, "generated-app");
    tempDirs.push(sourceDir, targetParent);

    await mkdir(join(sourceDir, "app"), { recursive: true });
    await mkdir(join(sourceDir, "src"), { recursive: true });
    await mkdir(join(sourceDir, "examples/feature-packs/items/migrations"), { recursive: true });
    await mkdir(join(sourceDir, "migrations"), { recursive: true });
    await writeFile(join(sourceDir, "package.json"), JSON.stringify({ name: "cf-starter" }, null, 2));
    await writeFile(join(sourceDir, "wrangler.jsonc"), '{ "name": "cf-starter", "d1_databases": [{ "database_name": "cf-starter-db" }] }\n');
    await writeFile(join(sourceDir, "README.md"), "# cf-starter\n");
    await writeFile(join(sourceDir, "app/App.tsx"), "cf-starter\nStarter Core\n");
    await writeFile(
      join(sourceDir, "src/index.ts"),
      'import items from "../examples/feature-packs/items/server/routes";\napp.route("/api/items", items)\n'
    );
    await writeFile(join(sourceDir, "migrations/0001_init.sql"), "-- core\n");
    await writeFile(
      join(sourceDir, "examples/feature-packs/items/migrations/0010_example_items.sql"),
      "-- example items\n"
    );

    await scaffoldStarter({
      sourceDir,
      targetDir,
      appName: "generated-app",
      include: ["items"],
    });

    expect(await readFile(join(targetDir, "migrations/0001_init.sql"), "utf8")).toContain("-- core");
    expect(await readFile(join(targetDir, "migrations/0010_example_items.sql"), "utf8")).toContain("-- example items");
  });

  it("keeps generated app doctor runnable without starter-only manifest files", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-doctor-source-"));
    const targetParent = await mkdtemp(join(tmpdir(), "cf-starter-doctor-target-"));
    const targetDir = join(targetParent, "generated-app");
    tempDirs.push(sourceDir, targetParent);

    await mkdir(join(sourceDir, "app"), { recursive: true });
    await mkdir(join(sourceDir, "shared"), { recursive: true });
    await mkdir(join(sourceDir, "src"), { recursive: true });
    await mkdir(join(sourceDir, "migrations"), { recursive: true });
    await mkdir(join(sourceDir, "scripts"), { recursive: true });
    await mkdir(join(sourceDir, "scripts/lib"), { recursive: true });
    await mkdir(join(sourceDir, "scripts/lib/doctor"), { recursive: true });
    await mkdir(join(sourceDir, ".github/workflows"), { recursive: true });
    await writeFile(
      join(sourceDir, "package.json"),
      JSON.stringify(
        {
          name: "cf-starter",
          scripts: {
            doctor: "node scripts/doctor.mjs",
            "seed:demo": "node scripts/seed-demo.mjs",
          },
        },
        null,
        2
      )
    );
    await writeFile(join(sourceDir, ".gitignore"), "node_modules\n");
    await writeFile(join(sourceDir, ".github/workflows/ci.yml"), "name: CI\n");
    await writeFile(join(sourceDir, "drizzle.config.ts"), "export default {};\n");
    await writeFile(join(sourceDir, "index.html"), "<!doctype html>\n");
    await writeFile(join(sourceDir, "wrangler.jsonc"), '{ "name": "cf-starter", "d1_databases": [{ "database_name": "cf-starter-db" }] }\n');
    await writeFile(join(sourceDir, "README.md"), "# cf-starter\n");
    await writeFile(join(sourceDir, "app/App.tsx"), "cf-starter\nStarter Core\n");
    await writeFile(join(sourceDir, "src/index.ts"), 'app.route("/api/auth", auth)\n');
    await writeFile(join(sourceDir, "migrations/0001_init.sql"), "-- core\n");
    await writeFile(join(sourceDir, "shared/module-catalog.mjs"), "export const modules = [];\n");
    await writeFile(join(sourceDir, "tsconfig.json"), "{}\n");
    await writeFile(join(sourceDir, "vite.config.ts"), "export default {};\n");
    await writeFile(join(sourceDir, "vite.config.split.ts"), "export default {};\n");
    await writeFile(join(sourceDir, "vitest.config.ts"), "export default {};\n");
    await writeFile(join(sourceDir, "scripts/d1-migrate.mjs"), "console.log('migrate');\n");
    await writeFile(join(sourceDir, "scripts/doctor.mjs"), await readFile(join(process.cwd(), "scripts/doctor.mjs"), "utf8"));
    await writeFile(join(sourceDir, "scripts/generate-record.mjs"), "console.log('record');\n");
    await writeFile(join(sourceDir, "scripts/seed-demo.mjs"), await readFile(join(process.cwd(), "scripts/seed-demo.mjs"), "utf8"));
    await writeFile(join(sourceDir, "scripts/lib/doctor.mjs"), await readFile(join(process.cwd(), "scripts/lib/doctor.mjs"), "utf8"));
    await writeFile(join(sourceDir, "scripts/lib/doctor/cli.mjs"), await readFile(join(process.cwd(), "scripts/lib/doctor/cli.mjs"), "utf8"));
    await writeFile(join(sourceDir, "scripts/lib/doctor/checks.mjs"), await readFile(join(process.cwd(), "scripts/lib/doctor/checks.mjs"), "utf8"));
    await writeFile(join(sourceDir, "scripts/lib/doctor/context.mjs"), await readFile(join(process.cwd(), "scripts/lib/doctor/context.mjs"), "utf8"));
    await writeFile(join(sourceDir, "scripts/lib/doctor/report.mjs"), await readFile(join(process.cwd(), "scripts/lib/doctor/report.mjs"), "utf8"));
    await writeFile(join(sourceDir, "scripts/lib/example-migrations.mjs"), "export function exampleMigrations() {}\n");
    await writeFile(join(sourceDir, "scripts/lib/record-engine.mjs"), "export function recordEngine() {}\n");
    await writeFile(join(sourceDir, "scripts/lib/starter-catalog.mjs"), await readFile(join(process.cwd(), "scripts/lib/starter-catalog.mjs"), "utf8"));
    await writeFile(join(sourceDir, "scripts/lib/wrangler-config.mjs"), await readFile(join(process.cwd(), "scripts/lib/wrangler-config.mjs"), "utf8"));
    await writeFile(join(sourceDir, "scripts/create-cf-starter.mjs"), "console.log('starter');\n");
    await writeFile(join(sourceDir, "scripts/lib/starter-manifest.mjs"), "export const starter = true;\n");

    await scaffoldStarter({
      sourceDir,
      targetDir,
      appName: "generated-app",
    });

    await expect(readFile(join(targetDir, "scripts/lib/starter-manifest.mjs"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });

    const result = spawnSync(process.execPath, ["scripts/doctor.mjs"], {
      cwd: targetDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("resolves selected features from include and exclude lists", () => {
    expect(resolveSelectedFeatures()).toEqual(["items", "kv", "upload"]);
    expect(resolveSelectedFeatures({ include: ["items", "upload"] })).toEqual([
      "items",
      "upload",
    ]);
    expect(resolveSelectedFeatures({ exclude: ["kv"] })).toEqual([
      "items",
      "upload",
    ]);
    expect(resolveSelectedFeatures({ coreOnly: true, include: ["items"] })).toEqual([]);
  });

  it("validates project names", () => {
    expect(validateProjectName("regional-ops")).toBe("regional-ops");
    expect(() => validateProjectName("Regional Ops")).toThrow(
      'Invalid project name "Regional Ops"'
    );
    expect(() => validateProjectName("9regional")).toThrow(
      'Invalid project name "9regional"'
    );
  });

  it("rejects unknown features in scaffold plans", () => {
    expect(() =>
      buildScaffoldPlan({
        targetDir: "/tmp/regional-ops",
        include: ["unknown-feature"],
      })
    ).toThrow("Unknown feature in --include: unknown-feature.");
  });

  it("refuses to overwrite existing targets without force", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-existing-target-"));
    tempDirs.push(dir);
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-existing-source-"));
    tempDirs.push(sourceDir);

    await mkdir(join(sourceDir, "src"), { recursive: true });
    await writeFile(join(sourceDir, "src/index.ts"), "export const ok = true;");

    await expect(
      scaffoldStarter({
        sourceDir,
        targetDir: dir,
      })
    ).rejects.toThrow(`Refusing to overwrite existing directory: ${dir}.`);
  });

  it("removes excluded feature routes and items UI", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-feature-select-"));
    tempDirs.push(dir);

    await mkdir(join(dir, "src"), { recursive: true });
    await mkdir(join(dir, "src/db"), { recursive: true });
    await mkdir(join(dir, "app"), { recursive: true });
    await mkdir(join(dir, "app/pages"), { recursive: true });
    await mkdir(join(dir, "migrations"), { recursive: true });
    await mkdir(join(dir, "examples/feature-packs/items/server"), { recursive: true });
    await mkdir(join(dir, "examples/feature-packs/kv/server"), { recursive: true });
    await mkdir(join(dir, "examples/feature-packs/upload/server"), { recursive: true });
    await mkdir(join(dir, "examples/feature-packs/items/app/hooks"), { recursive: true });
    await mkdir(join(dir, "examples/feature-packs/items/shared"), { recursive: true });
    await writeFile(
      join(dir, "src/index.ts"),
      [
        'import items from "../examples/feature-packs/items/server/routes";',
        'import kv from "../examples/feature-packs/kv/server/routes";',
        'import upload from "../examples/feature-packs/upload/server/routes";',
        'app.route("/api/items", items)',
        'app.route("/api/kv", kv)',
        'app.route("/api/upload", upload)',
      ].join("\n")
    );
    await writeFile(
      join(dir, "app/App.tsx"),
      [
        '// scaffold:items-import:start',
        'import {',
        '  useItems,',
        '  useCreateItem,',
        '} from "../examples/feature-packs/items/app/hooks/useItems";',
        '// scaffold:items-import:end',
        '  // scaffold:items-state:start',
        '  const [name, setName] = useState("");',
        '  // scaffold:items-state:end',
        '  // scaffold:items-hooks:start',
        '  const { data: items = [], isLoading } = useItems(!!session);',
        '  // scaffold:items-hooks:end',
        '  // scaffold:items-hooks:start',
        '  const createItem = useCreateItem();',
        '  // scaffold:items-hooks:end',
        '  // scaffold:items-hooks:start',
        '  const handleAdd = () => {',
        '    if (!name.trim()) return;',
        '    createItem.mutate(name.trim());',
        '    setName("");',
        '  };',
        '  // scaffold:items-hooks:end',
        '            {/* scaffold:items-panel:start */}',
        '            <Panel',
        '              title="D1 Items"',
        '              subtitle="Example feature は残して、core 追加後も RPC client と mutation が崩れていないことを見ます。"',
        '            >',
        '              body',
        '            </Panel>',
        '            {/* scaffold:items-panel:end */}',
      ].join("\n")
    );
    await writeFile(
      join(dir, "app/pages/HomePage.tsx"),
      [
        '// scaffold:items-home-import:start',
        'import { useItems } from "../../examples/feature-packs/items/app/hooks/useItems";',
        '// scaffold:items-home-import:end',
        'export function HomePage() {',
        '  // scaffold:items-home-hooks:start',
        '  const { data: items = [], isLoading } = useItems(true);',
        '  // scaffold:items-home-hooks:end',
        '  return <div>{items.length}{isLoading ? "loading" : "ready"}</div>;',
        '}',
      ].join("\n")
    );
    await writeFile(
      join(dir, "src/db/schema.ts"),
      [
        'export const organizations = {};',
        '// scaffold:items-schema:start',
        'export { items } from "../../examples/feature-packs/items/server/db-schema";',
        '// scaffold:items-schema:end',
      ].join("\n")
    );
    await writeFile(join(dir, "migrations/0010_example_items.sql"), "-- items\n");

    await applyFeatureSelection(dir, ["kv", "upload"]);

    const indexSource = await readFile(join(dir, "src/index.ts"), "utf8");
    const appSource = await readFile(join(dir, "app/App.tsx"), "utf8");
    const homePageSource = await readFile(join(dir, "app/pages/HomePage.tsx"), "utf8");
    const dbSchemaSource = await readFile(join(dir, "src/db/schema.ts"), "utf8");

    expect(indexSource).not.toContain("/api/items");
    expect(indexSource).toContain("/api/kv");
    expect(appSource).not.toContain("D1 Items");
    expect(appSource).not.toContain("useItems");
    expect(homePageSource).toContain("generated without the example items feature");
    expect(dbSchemaSource).not.toContain("db-schema");
    await expect(readFile(join(dir, "migrations/0010_example_items.sql"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("removes marker-based excluded feature blocks from index", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-feature-markers-"));
    tempDirs.push(dir);

    await mkdir(join(dir, "examples/feature-packs/items/server"), { recursive: true });
    await mkdir(join(dir, "examples/feature-packs/kv/server"), { recursive: true });
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(
      join(dir, "src/index.ts"),
      [
        '// scaffold:feature-import:start items',
        'import items from "../examples/feature-packs/items/server/routes";',
        '// scaffold:feature-import:end items',
        '// scaffold:feature-import:start kv',
        'import kv from "../examples/feature-packs/kv/server/routes";',
        '// scaffold:feature-import:end kv',
        'app',
        '// scaffold:feature-route:start items',
        '  .route("/api/items", items)',
        '// scaffold:feature-route:end items',
        '// scaffold:feature-route:start kv',
        '  .route("/api/kv", kv)',
        '// scaffold:feature-route:end kv',
        '  .route("/api/auth", auth)',
      ].join("\n")
    );

    await applyFeatureSelection(dir, ["kv"]);

    const indexSource = await readFile(join(dir, "src/index.ts"), "utf8");
    expect(indexSource).not.toContain('scaffold:feature-import:start items');
    expect(indexSource).not.toContain("/api/items");
    expect(indexSource).toContain("/api/kv");
    expect(indexSource).toContain("/api/auth");
  });

  it("removes marker-based items blocks from app and schema without content-specific patterns", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-items-markers-"));
    tempDirs.push(dir);

    await mkdir(join(dir, "src"), { recursive: true });
    await mkdir(join(dir, "src/db"), { recursive: true });
    await mkdir(join(dir, "app"), { recursive: true });
    await writeFile(join(dir, "src/index.ts"), 'app.route("/api/auth", auth);\n');
    await writeFile(
      join(dir, "app/App.tsx"),
      [
        "import { AppShell } from './components/AppShell';",
        "// scaffold:items-import:start",
        "import { useExperimentalItems } from '../examples/feature-packs/items/app/hooks/useExperimentalItems';",
        "// scaffold:items-import:end",
        "export default function App() {",
        "  // scaffold:items-state:start",
        "  const [draftItemName, setDraftItemName] = useState('');",
        "  // scaffold:items-state:end",
        "  // scaffold:items-hooks:start",
        "  const itemsQuery = useExperimentalItems();",
        "  // scaffold:items-hooks:end",
        "  return (",
        "    <AppShell>",
        "      {/* scaffold:items-panel:start */}",
        "      <section>Experimental items panel</section>",
        "      {/* scaffold:items-panel:end */}",
        "    </AppShell>",
        "  );",
        "}",
      ].join("\n")
    );
    await writeFile(
      join(dir, "src/db/schema.ts"),
      [
        "export const organizations = {};",
        "// scaffold:items-schema:start",
        'export const experimentalItems = sqliteTable("experimental_items", {});',
        "// scaffold:items-schema:end",
      ].join("\n")
    );

    await applyFeatureSelection(dir, []);

    const appSource = await readFile(join(dir, "app/App.tsx"), "utf8");
    const dbSchemaSource = await readFile(join(dir, "src/db/schema.ts"), "utf8");

    expect(appSource).not.toContain("useExperimentalItems");
    expect(appSource).not.toContain("Experimental items panel");
    expect(appSource).not.toContain("scaffold:items-import:start");
    expect(dbSchemaSource).not.toContain("experimental_items");
    expect(dbSchemaSource).not.toContain("scaffold:items-schema:start");
    expect(dbSchemaSource).toContain("organizations");
  });

  it("builds scaffold summary with required bindings and next steps", () => {
    const summary = buildScaffoldSummary({
      appName: "regional-ops",
      coreOnly: false,
      selectedFeatures: ["items", "upload"],
    });

    expect(summary.requiredBindings).toEqual(["DB", "JOBS", "RATE_LIMITER", "BUCKET"]);
    expect(summary.profile).toBe("optional-examples");
    expect(summary.nextSteps).toContain("Run npm install");
    expect(summary.nextSteps).toContain("Run npm run doctor");
    expect(summary.nextSteps).toContain("Set real d1 database_id and queue name in wrangler.jsonc");
    expect(summary.nextSteps).toContain("Create or wire the R2 bucket, then set the BUCKET binding in wrangler.jsonc");
    expect(summary.nextSteps).not.toContain("Create or wire the KV namespace, then set the KV binding in wrangler.jsonc");
    expect(summary.nextSteps.at(-1)).toContain("items, upload");
  });

  it("keeps core-first next steps free of optional KV and R2 setup", () => {
    const summary = buildScaffoldSummary({
      appName: "regional-ops",
      coreOnly: true,
      selectedFeatures: [],
    });

    expect(summary.requiredBindings).toEqual(["DB", "JOBS", "RATE_LIMITER"]);
    expect(summary.profile).toBe("core-only");
    expect(summary.nextSteps).toContain("Run npm run doctor");
    expect(summary.nextSteps).toContain("Set real d1 database_id and queue name in wrangler.jsonc");
    expect(summary.nextSteps).not.toContain("Create or wire the KV namespace, then set the KV binding in wrangler.jsonc");
    expect(summary.nextSteps).not.toContain("Create or wire the R2 bucket, then set the BUCKET binding in wrangler.jsonc");
    expect(summary.nextSteps.at(-1)).toContain("src/routes or src/features");
  });

  it("builds a scaffold plan without copying files", () => {
    const plan = buildScaffoldPlan({
      targetDir: "/tmp/regional-ops",
      appName: "regional-ops",
      exclude: ["kv", "upload"],
    });

    expect(plan.mode).toBe("starter");
    expect(plan.profile).toBe("optional-examples");
    expect(plan.selectedFeatures).toEqual(["items"]);
    expect(plan.removedFeatures).toEqual(["kv", "upload"]);
    expect(plan.requiredBindings).toEqual(["DB", "JOBS", "RATE_LIMITER"]);
    expect(plan.coreBindingsKept).toEqual(["DB", "JOBS", "RATE_LIMITER"]);
    expect(plan.coreBindingReasons).toEqual({
      DB: "Core auth, organizations, sessions, audit logs, and example D1 data use D1.",
      JOBS: "Invite, password reset, email verification, and welcome mail flows enqueue queue jobs.",
      RATE_LIMITER: "Auth rate limiting uses the Durable Object binding.",
    });
    expect(plan.bindingsRemoved).toEqual(["KV", "BUCKET"]);
    expect(plan.bindingRemovalReasons).toEqual({
      KV: "Only the kv example feature uses the KV binding.",
      BUCKET: "Only the upload example feature uses the R2 bucket binding.",
    });
    expect(plan.warnings).toContain(
      "JOBS binding remains required for invite, password reset, email verification, and welcome mail flows."
    );
    expect(plan.filesRemoved).toEqual([
      "bin/create-cf-starter",
      "scripts/check-publish-ready.mjs",
      "scripts/compat/app-plan.mjs",
      "scripts/compat/modules-plan.mjs",
      "scripts/compat/scaffold-app.mjs",
      "scripts/create-cf-starter.mjs",
      "scripts/internal/check-template-directory.mjs",
      "scripts/internal/app-plan.mjs",
      "scripts/internal/materialize-template-candidate.mjs",
      "scripts/internal/modules-plan.mjs",
      "scripts/internal/scaffold-app.mjs",
      "scripts/internal/snapshot-template.mjs",
      "scripts/internal/template-report-cli.mjs",
      "scripts/internal/sync-template-directory.mjs",
      "scripts/internal/template-cli-options.mjs",
      "scripts/lib/app-plan.mjs",
      "scripts/lib/cli-args.mjs",
      "scripts/lib/scaffold/orchestrator.mjs",
      "scripts/lib/scaffold/planner.mjs",
      "scripts/lib/scaffold/renderers/app-template.mjs",
      "scripts/lib/scaffold/renderers/readme.mjs",
      "scripts/lib/scaffold/renderers/workflow.mjs",
      "scripts/lib/scaffold/transforms/cleanup.mjs",
      "scripts/lib/scaffold/transforms/app-metadata.mjs",
      "scripts/lib/scaffold/transforms/file-ops.mjs",
      "scripts/lib/scaffold/transforms/feature-selection.mjs",
      "scripts/lib/scaffold/transforms/helpers.mjs",
      "scripts/lib/scaffold/transforms/index-selection.mjs",
      "scripts/lib/scaffold/transforms/items-selection.mjs",
      "scripts/lib/scaffold/transforms/jsonc.mjs",
      "scripts/lib/scaffold/transforms/metadata.mjs",
      "scripts/lib/scaffold/transforms/package-metadata.mjs",
      "scripts/lib/scaffold/transforms/readme-metadata.mjs",
      "scripts/lib/scaffold/transforms/scaffold-markers.mjs",
      "scripts/lib/scaffold/transforms/wrangler.mjs",
      "scripts/lib/scaffold/transforms/wrangler-metadata.mjs",
      "scripts/lib/modules-plan.mjs",
      "scripts/lib/scaffold.mjs",
      "scripts/lib/deprecation.mjs",
      "scripts/lib/starter-manifest.mjs",
      "scripts/lib/template-candidate.mjs",
      "scripts/lib/template-directory.mjs",
      "scripts/lib/template-snapshot.mjs",
      "scripts/lib/template-manifest.mjs",
      "scripts/lib/template-source.mjs",
      "scripts/test-create.mjs",
      "test/create-cf-starter.test.ts",
      "test/deprecated-cli.test.ts",
      "test/doctor.test.ts",
      "test/module-plan.test.ts",
      "test/public-surface.test.ts",
      "test/scaffold.test.ts",
      "test/starter-manifest.test.ts",
      "test/template-candidate.test.ts",
      "test/template-manifest.test.ts",
      "test/template-snapshot.test.ts",
      "test/example-organization-scope.test.ts",
      "test/fixtures/template-snapshots",
      "ARCHITECTURE.md",
      "CLAUDE.md",
      "ROADMAP.md",
      "examples/feature-packs/kv/",
      "examples/feature-packs/upload/",
      "examples/lib/",
    ]);
    expect(plan.filesRewritten).toEqual([
      "package.json",
      "wrangler.jsonc",
      "README.md",
      "app/App.tsx",
      ".github/workflows/ci.yml",
      "src/index.ts",
    ]);
    expect(plan.transforms).toContain("Remove example features: kv, upload");
    expect(plan.transforms).toContain("Rewrite src/index.ts to mount only selected example routes");
    expect(plan.transforms).toContain("Remove starter-only scripts, tests, and docs from the generated app");
  });

  it("adds warnings for core-only plans", () => {
    const plan = buildScaffoldPlan({
      targetDir: "/tmp/regional-ops",
      appName: "regional-ops",
      coreOnly: true,
    });

    expect(plan.warnings).toContain(
      "Core-only still keeps organization, auth, queue, and scheduled maintenance features."
    );
    expect(plan.coreBindingsKept).toEqual(["DB", "JOBS", "RATE_LIMITER"]);
    expect(plan.coreBindingReasons.JOBS).toContain("Invite, password reset, email verification");
    expect(plan.bindingsRemoved).toEqual(["KV", "BUCKET"]);
    expect(plan.bindingRemovalReasons.KV).toContain("kv example feature");
  });

  it("tailors README stack and checklist to selected bindings", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-readme-tailor-"));
    tempDirs.push(dir);

    await writeFile(
      join(dir, "README.md"),
      [
        "## スタック",
        "",
        "| レイヤー | 技術 |",
        "|---|---|",
        "| Frontend | React + TypeScript + Tailwind CSS + TanStack Query |",
        "| Backend | Hono on Cloudflare Workers |",
        "| Database | D1 (SQLite) + Drizzle ORM |",
        "| Storage | R2 |",
        "| Cache | KV |",
        "| Rate limit | Durable Object |",
        "| Async jobs | Cloudflare Queues |",
        "",
        "## クイックスタート",
        "",
        "## 本番チェックリスト",
        "",
        "- [ ] `wrangler.jsonc` の `database_id` / KV / R2 / Queue binding を実値にする",
        "- [ ] Queue 名を変更した場合は producer / consumer を揃える",
        "",
        "## 現在の不足",
      ].join("\n")
    );

    await rewriteScaffoldMetadata(dir, "regional-ops", {
      coreOnly: false,
      selectedFeatures: ["items"],
      requiredBindings: ["DB", "JOBS", "RATE_LIMITER"],
    });

    const readme = await readFile(join(dir, "README.md"), "utf8");
    expect(readme).not.toContain("| Storage | R2 |");
    expect(readme).not.toContain("| Cache | KV |");
    expect(readme).not.toContain("KV binding");
    expect(readme).not.toContain("R2 binding");
    expect(readme).toContain("Queue binding");
  });

  it("tailors the queue section to selected example features", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-queue-tailor-"));
    tempDirs.push(dir);

    await writeFile(
      join(dir, "README.md"),
      [
        "## Queue",
        "",
        "`JOBS` Queue binding を持ち、core と optional examples の両方で job を enqueue します。",
        "",
        "- `user.welcome`",
        "- `upload.process`",
        "",
        "consumer は Worker module の `queue()` handler で処理します。",
        "",
        "organization invite 作成時には `organization.invite_email` job も enqueue されます。",
        "現状の consumer は delivery payload を structured log に出す実装で、実メール送信プロバイダへの差し替え点として使います。",
        "",
        "password reset request 時には `auth.password_reset_email` job も enqueue されます。",
        "signup と verification 再送時には `auth.email_verification_email` job も enqueue されます。",
        "`EMAIL_PROVIDER=resend`、`RESEND_API_KEY`、`EMAIL_FROM` を設定すると Resend 経由で実送信します。未設定時は `log` fallback です。",
        "",
        "## Module Plan",
      ].join("\n")
    );

    await rewriteScaffoldMetadata(dir, "regional-ops", {
      coreOnly: false,
      selectedFeatures: ["items"],
      requiredBindings: ["DB", "JOBS", "RATE_LIMITER"],
    });

    const readme = await readFile(join(dir, "README.md"), "utf8");
    expect(readme).toContain("# regional-ops");
    expect(readme).toContain("npm install");
    expect(readme).toContain("Queue binding");
  });

  it("tailors the feature structure section to selected features", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-feature-structure-"));
    tempDirs.push(dir);

    await writeFile(
      join(dir, "README.md"),
      [
        "## Feature Structure",
        "",
        "`cf-starter` は段階的に feature-based structure へ寄せています。",
        "",
        "- core routes: `src/routes/`",
        "- example feature routes: `examples/feature-packs/*/server/routes.ts`",
        "- core hooks: `app/hooks/`",
        "- example feature hooks: `examples/feature-packs/items/app/hooks/`",
        "- core schema: `shared/schemas/`",
        "- example feature schema: `examples/feature-packs/items/shared/`",
        "",
        "新しい業務機能を追加する場合は、まず `core` へ入れるべき共通機能か、`example` や派生アプリ固有の feature かを分けてから配置してください。",
        "example feature であっても、業務テーブルは `organization_id` を持たせて current organization で絞るのを基本にします。",
        "",
        "## 開発の流れ",
      ].join("\n")
    );

    await rewriteScaffoldMetadata(dir, "regional-ops", {
      coreOnly: false,
      selectedFeatures: ["kv"],
      requiredBindings: ["DB", "JOBS", "RATE_LIMITER", "KV"],
    });

    const readme = await readFile(join(dir, "README.md"), "utf8");
    expect(readme).toContain("# regional-ops");
    expect(readme).toContain("| Cache | KV |");
  });

  it("tailors the directory structure section to selected features", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-directory-structure-"));
    tempDirs.push(dir);

    await writeFile(
      join(dir, "README.md"),
      [
        "## ディレクトリ構成",
        "",
        "```text",
        "cf-starter/",
        "├── app/                    React UI",
        "│   ├── hooks/              core hooks",
        "│   └── lib/api.ts          型付き Hono RPC client",
        "├── examples/               selected example feature packs",
        "│   ├── feature-packs/      app / shared / server example code",
        "├── shared/                 フロント・バック共有契約",
        "│   └── schemas/            core schema",
        "├── src/                    Worker backend",
        "│   ├── db/                 Drizzle schema",
        "│   ├── durable-objects/    rate limiter",
        "│   ├── lib/                auth, session, audit, organizations など",
        "│   ├── middleware/         auth, csrf, role, request-id",
        "│   ├── queues/             queue producer / consumer",
        "│   ├── routes/             core API routes",
        "│   └── index.ts            Worker entrypoint",
        "├── migrations/             core migrations",
        "├── scripts/                補助スクリプト",
        "├── test/                   unit / integration tests",
        "└── README.md",
        "```",
        "",
        "## Core API",
      ].join("\n")
    );

    await rewriteScaffoldMetadata(dir, "regional-ops", {
      coreOnly: false,
      selectedFeatures: ["kv"],
      requiredBindings: ["DB", "JOBS", "RATE_LIMITER", "KV"],
    });

    const readme = await readFile(join(dir, "README.md"), "utf8");
    expect(readme).toContain("# regional-ops");
    expect(readme).toContain("| Cache | KV |");

    await rewriteScaffoldMetadata(dir, "regional-ops", {
      coreOnly: true,
      selectedFeatures: [],
      requiredBindings: ["DB", "JOBS", "RATE_LIMITER"],
    });

    const coreOnlyReadme = await readFile(join(dir, "README.md"), "utf8");
    expect(coreOnlyReadme).toContain("# regional-ops");
    expect(coreOnlyReadme).not.toContain("| Cache | KV |");
  });
});
