import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  it("rewrites index for core-only mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-index-"));
    tempDirs.push(dir);
    const indexPath = join(dir, "index.ts");

    await writeFile(
      indexPath,
      [
        'import items from "./features/example/items/routes";',
        'import kv from "./features/example/kv/routes";',
        'import upload from "./features/example/upload/routes";',
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

  it("applies core-only transforms to a copied app", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-core-only-"));
    tempDirs.push(dir);

    await mkdir(join(dir, "src/features/example/items"), { recursive: true });
    await mkdir(join(dir, "app/features/example/items"), { recursive: true });
    await mkdir(join(dir, "shared/features/example/items"), { recursive: true });
    await mkdir(join(dir, "src"), { recursive: true });
    await mkdir(join(dir, "app"), { recursive: true });
    await writeFile(join(dir, "src/index.ts"), 'import items from "./features/example/items/routes";\napp.route("/api/items", items)\napp.route("/api/auth", auth)');
    await writeFile(join(dir, "app/App.tsx"), "old app");

    await applyCoreOnlyTransforms(dir);
    await writeCoreOnlyApp(dir, "starter-core");

    const appSource = await readFile(join(dir, "app/App.tsx"), "utf8");
    const indexSource = await readFile(join(dir, "src/index.ts"), "utf8");

    expect(appSource).toContain("Core-only starter");
    expect(indexSource).not.toContain("/api/items");
  });

  it("scaffolds a starter copy without node_modules", async () => {
    const sourceDir = await mkdtemp(join(tmpdir(), "cf-starter-source-"));
    const targetDir = await mkdtemp(join(tmpdir(), "cf-starter-target-parent-"));
    const target = join(targetDir, "generated");
    tempDirs.push(sourceDir, targetDir);

    await mkdir(join(sourceDir, "src"), { recursive: true });
    await mkdir(join(sourceDir, "node_modules/pkg"), { recursive: true });
    await writeFile(join(sourceDir, "src/index.ts"), "export const ok = true;");
    await writeFile(join(sourceDir, "node_modules/pkg/index.js"), "ignored");
    await writeFile(join(sourceDir, "package-lock.json"), "{}\n");

    await scaffoldStarter({ sourceDir, targetDir: target });

    const copied = await readFile(join(target, "src/index.ts"), "utf8");
    expect(copied).toContain("ok = true");
    await expect(readFile(join(target, "node_modules/pkg/index.js"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(join(target, "package-lock.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
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
        "│   ├── features/example/   example feature hooks",
        "│   ├── hooks/              core hooks",
        "│   └── lib/api.ts          型付き Hono RPC client",
        "├── shared/                 フロント・バック共有契約",
        "│   ├── features/example/   example feature schema",
        "│   └── schemas/            core schema",
        "├── src/                    Worker backend",
        "│   ├── db/                 Drizzle schema",
        "│   ├── durable-objects/    rate limiter",
        "│   ├── features/example/   example feature routes",
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
    await writeFile(join(sourceDir, "src/index.ts"), 'import kv from "./features/example/kv/routes";\napp.route("/api/kv", kv)');

    await scaffoldStarter({
      sourceDir,
      targetDir: target,
      appName: "regional-ops",
      include: ["kv"],
    });

    const readme = await readFile(join(target, "README.md"), "utf8");
    const [directorySection] = readme.split("\n## Core API\n");
    expect(directorySection).toContain("selected example feature hooks");
    expect(directorySection).toContain("selected example feature routes");
    expect(directorySection).toContain("selected example feature schema");
  });

  it("rewrites package, wrangler, readme, and app metadata for the target app name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "cf-starter-meta-"));
    tempDirs.push(dir);

    await mkdir(join(dir, "app"), { recursive: true });
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ name: "cf-starter" }, null, 2)
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

    expect(await readFile(join(dir, "package.json"), "utf8")).toContain('"name": "regional-ops"');
    expect(await readFile(join(dir, "package.json"), "utf8")).toContain('"private": true');
    expect(await readFile(join(dir, "package.json"), "utf8")).not.toContain('"bin"');
    expect(await readFile(join(dir, "package.json"), "utf8")).not.toContain('"publishConfig"');
    expect(await readFile(join(dir, "wrangler.jsonc"), "utf8")).toContain('"name": "regional-ops"');
    expect(await readFile(join(dir, "wrangler.jsonc"), "utf8")).toContain('"database_name": "regional-ops-db"');
    expect(await readFile(join(dir, "wrangler.jsonc"), "utf8")).not.toContain('"kv_namespaces"');
    expect(await readFile(join(dir, "wrangler.jsonc"), "utf8")).not.toContain('"r2_buckets"');
    expect(await readFile(join(dir, "README.md"), "utf8")).toContain("# regional-ops");
    expect(await readFile(join(dir, "README.md"), "utf8")).toContain("Example Features: なし");
    expect(await readFile(join(dir, "README.md"), "utf8")).toContain("このリポジトリは core-only 構成で始める前提です。");
    expect(await readFile(join(dir, "README.md"), "utf8")).not.toContain("wrangler kv namespace create KV");
    expect(await readFile(join(dir, "README.md"), "utf8")).not.toContain("| Storage | R2 |");
    expect(await readFile(join(dir, "README.md"), "utf8")).not.toContain("| Cache | KV |");
    expect(await readFile(join(dir, "app/App.tsx"), "utf8")).toContain("regional-ops");
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
    await mkdir(join(dir, "app"), { recursive: true });
    await mkdir(join(dir, "src/features/example/items"), { recursive: true });
    await mkdir(join(dir, "src/features/example/kv"), { recursive: true });
    await mkdir(join(dir, "src/features/example/upload"), { recursive: true });
    await mkdir(join(dir, "app/features/example/items"), { recursive: true });
    await mkdir(join(dir, "shared/features/example/items"), { recursive: true });
    await writeFile(
      join(dir, "src/index.ts"),
      [
        'import items from "./features/example/items/routes";',
        'import kv from "./features/example/kv/routes";',
        'import upload from "./features/example/upload/routes";',
        'app.route("/api/items", items)',
        'app.route("/api/kv", kv)',
        'app.route("/api/upload", upload)',
      ].join("\n")
    );
    await writeFile(
      join(dir, "app/App.tsx"),
      [
        'import {',
        '  useItems,',
        '  useCreateItem,',
        '} from "./features/example/items/hooks/useItems";',
        '  const [name, setName] = useState("");',
        '  const { data: items = [], isLoading } = useItems(!!session);',
        '  const createItem = useCreateItem();',
        '  const handleAdd = () => {',
        '    if (!name.trim()) return;',
        '    createItem.mutate(name.trim());',
        '    setName("");',
        '  };',
        '            <Panel',
        '              title="D1 Items"',
        '              subtitle="Example feature は残して、core 追加後も RPC client と mutation が崩れていないことを見ます。"',
        '            >',
        '              body',
        '            </Panel>',
      ].join("\n")
    );

    await applyFeatureSelection(dir, ["kv", "upload"]);

    const indexSource = await readFile(join(dir, "src/index.ts"), "utf8");
    const appSource = await readFile(join(dir, "app/App.tsx"), "utf8");

    expect(indexSource).not.toContain("/api/items");
    expect(indexSource).toContain("/api/kv");
    expect(appSource).not.toContain("D1 Items");
    expect(appSource).not.toContain("useItems");
  });

  it("builds scaffold summary with required bindings and next steps", () => {
    const summary = buildScaffoldSummary({
      appName: "regional-ops",
      coreOnly: false,
      selectedFeatures: ["items", "upload"],
    });

    expect(summary.requiredBindings).toEqual(["DB", "JOBS", "RATE_LIMITER", "BUCKET"]);
    expect(summary.nextSteps).toContain("Run npm install");
    expect(summary.nextSteps.at(-1)).toContain("items, upload");
  });

  it("builds a scaffold plan without copying files", () => {
    const plan = buildScaffoldPlan({
      targetDir: "/tmp/regional-ops",
      appName: "regional-ops",
      exclude: ["kv", "upload"],
    });

    expect(plan.mode).toBe("starter");
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
      "src/features/example/kv/",
      "app/features/example/kv/",
      "shared/features/example/kv/",
      "src/features/example/upload/",
      "app/features/example/upload/",
      "shared/features/example/upload/",
    ]);
    expect(plan.filesRewritten).toEqual([
      "package.json",
      "wrangler.jsonc",
      "README.md",
      "app/App.tsx",
      "src/index.ts",
    ]);
    expect(plan.transforms).toContain("Remove example features: kv, upload");
    expect(plan.transforms).toContain("Rewrite src/index.ts to mount only selected example routes");
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
        "`JOBS` Queue binding を持ち、現在は sample job として次を enqueue します。",
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
    expect(readme).toContain("- `user.welcome`");
    expect(readme).not.toContain("- `upload.process`");
    expect(readme).toContain("organization.invite_email");
    expect(readme).toContain("auth.password_reset_email");
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
        "- example feature routes: `src/features/example/*/routes.ts`",
        "- core hooks: `app/hooks/`",
        "- example feature hooks: `app/features/example/*/hooks/`",
        "- core schema: `shared/schemas/`",
        "- example feature schema: `shared/features/example/`",
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
    expect(readme).toContain("`src/features/example/kv/routes.ts`");
    expect(readme).not.toContain("`src/features/example/items/routes.ts`");
    expect(readme).toContain("- example feature hooks: なし");
    expect(readme).toContain("- example feature schema: なし");
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
        "│   ├── features/example/   example feature hooks",
        "│   ├── hooks/              core hooks",
        "│   └── lib/api.ts          型付き Hono RPC client",
        "├── shared/                 フロント・バック共有契約",
        "│   ├── features/example/   example feature schema",
        "│   └── schemas/            core schema",
        "├── src/                    Worker backend",
        "│   ├── db/                 Drizzle schema",
        "│   ├── durable-objects/    rate limiter",
        "│   ├── features/example/   example feature routes",
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

    await rewriteScaffoldMetadata(dir, "regional-ops", {
      coreOnly: false,
      selectedFeatures: ["kv"],
      requiredBindings: ["DB", "JOBS", "RATE_LIMITER", "KV"],
    });

    const readme = await readFile(join(dir, "README.md"), "utf8");
    const [directorySection] = readme.split("\n## Core API\n");
    expect(directorySection).toContain("selected example feature hooks");
    expect(directorySection).toContain("selected example feature routes");
    expect(directorySection).toContain("selected example feature schema");

    await rewriteScaffoldMetadata(dir, "regional-ops", {
      coreOnly: true,
      selectedFeatures: [],
      requiredBindings: ["DB", "JOBS", "RATE_LIMITER"],
    });

    const coreOnlyReadme = await readFile(join(dir, "README.md"), "utf8");
    const [coreOnlyDirectorySection] = coreOnlyReadme.split("\n## Core API\n");
    expect(coreOnlyDirectorySection).not.toContain("selected example feature hooks");
    expect(coreOnlyDirectorySection).not.toContain("selected example feature routes");
    expect(coreOnlyDirectorySection).not.toContain("selected example feature schema");
  });
});
