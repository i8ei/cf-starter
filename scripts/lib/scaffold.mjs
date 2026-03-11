import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { materializeFeatureMigrations } from "./example-migrations.mjs";
import { starterManifest } from "./starter-manifest.mjs";

const COPY_EXCLUDES = new Set([
  ".git",
  "node_modules",
  "dist",
  ".wrangler",
  "package-lock.json",
]);
const GENERATED_APP_REMOVED_PATHS = [
  "bin/create-cf-starter",
  "scripts/check-publish-ready.mjs",
  "scripts/compat/app-plan.mjs",
  "scripts/compat/modules-plan.mjs",
  "scripts/compat/scaffold-app.mjs",
  "scripts/create-cf-starter.mjs",
  "scripts/internal/app-plan.mjs",
  "scripts/internal/modules-plan.mjs",
  "scripts/internal/scaffold-app.mjs",
  "scripts/lib/app-plan.mjs",
  "scripts/lib/modules-plan.mjs",
  "scripts/lib/scaffold.mjs",
  "scripts/lib/starter-manifest.mjs",
  "scripts/test-create.mjs",
  "test/create-cf-starter.test.ts",
  "test/deprecated-cli.test.ts",
  "test/doctor.test.ts",
  "test/module-plan.test.ts",
  "test/public-surface.test.ts",
  "test/scaffold.test.ts",
  "test/starter-manifest.test.ts",
  "ARCHITECTURE.md",
  "CLAUDE.md",
  "ROADMAP.md",
];
const GENERATED_APP_REWRITTEN_PATHS = [
  ".github/workflows/ci.yml",
];

const EXAMPLE_FEATURE_KEYS = starterManifest.exampleFeatures.map((feature) => feature.key);
const CORE_REQUIRED_BINDINGS = ["DB", "JOBS", "RATE_LIMITER"];
const CORE_BINDING_REASONS = {
  DB: "Core auth, organizations, sessions, audit logs, and example D1 data use D1.",
  JOBS: "Invite, password reset, email verification, and welcome mail flows enqueue queue jobs.",
  RATE_LIMITER: "Auth rate limiting uses the Durable Object binding.",
};
const REMOVABLE_BINDING_REASONS = {
  KV: "Only the kv example feature uses the KV binding.",
  BUCKET: "Only the upload example feature uses the R2 bucket binding.",
};
const PROJECT_NAME_PATTERN = /^[a-z][a-z0-9-]{0,62}$/;

const CORE_ONLY_APP_TEMPLATE = `import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { useSession } from "./hooks/useSession";
import { AppShell } from "./components/AppShell";
import { AuthPage } from "./pages/AuthPage";
import { SettingsPage } from "./pages/SettingsPage";

const queryClient = new QueryClient();

/**
 * Record Engine nav items — add entries here as you generate new records.
 * Each record page will be mounted at /:recordKey
 */
const recordNavItems: { label: string; href: string }[] = [
  // Example: { label: "Houses", href: "/houses" },
];

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading } = useSession();
  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </AppShell>
    );
  }
  if (!session) {
    return (
      <AppShell>
        <AuthPage />
      </AppShell>
    );
  }
  return (
    <AppShell navItems={recordNavItems}>
      {children}
    </AppShell>
  );
}

function WelcomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-white">__APP_DISPLAY_NAME__</h1>
      <p className="text-sm text-slate-400">
        Ready to go. Add your first record with the Record Engine.
      </p>
    </div>
  );
}

function AppRoutes() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/settings" component={SettingsPage} />
        <Route path="/" component={WelcomePage} />
        {/* record-engine:routes */}
        <Route>
          <div className="mx-auto max-w-3xl py-20 text-center">
            <h2 className="text-xl font-semibold text-white">404</h2>
            <p className="mt-2 text-sm text-slate-400">Page not found</p>
          </div>
        </Route>
      </Switch>
    </AuthGuard>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
`;

function shouldCopy(sourcePath) {
  const parts = sourcePath.split("/").filter(Boolean);
  return !parts.some((part) => COPY_EXCLUDES.has(part));
}

function toDisplayName(appName) {
  return appName
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildValidationError(message) {
  const error = new Error(message);
  error.name = "ScaffoldValidationError";
  return error;
}

export function validateProjectName(appName) {
  if (!appName || typeof appName !== "string") {
    throw buildValidationError("Project name is required.");
  }

  if (!PROJECT_NAME_PATTERN.test(appName)) {
    throw buildValidationError(
      `Invalid project name "${appName}". Use 1-63 chars, start with a lowercase letter, and use only lowercase letters, numbers, and hyphens.`
    );
  }

  return appName;
}

function validateFeatureList(featureList, optionName) {
  const unknown = featureList.filter((feature) => !EXAMPLE_FEATURE_KEYS.includes(feature));
  if (unknown.length > 0) {
    throw buildValidationError(
      `Unknown feature in ${optionName}: ${unknown.join(", ")}. Available features: ${EXAMPLE_FEATURE_KEYS.join(", ")}.`
    );
  }
}

function buildCoreOnlyAppTemplate(appName) {
  return CORE_ONLY_APP_TEMPLATE.replaceAll("__APP_DISPLAY_NAME__", toDisplayName(appName));
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function rewriteTextFile(filePath, updater) {
  const source = await readFile(filePath, "utf8");
  await writeFile(filePath, updater(source));
}

function removeJsoncPropertyBlock(source, propertyName) {
  const pattern = new RegExp(`\\n\\s*"${propertyName}":\\s*(?:\\[[\\s\\S]*?\\]|\\{[\\s\\S]*?\\}),?`, "m");
  return source.replace(pattern, "");
}

export function resolveSelectedFeatures({
  coreOnly = false,
  include = [],
  exclude = [],
} = {}) {
  if (coreOnly) return [];

  const includeSet = new Set(include.filter(Boolean));
  const excludeSet = new Set(exclude.filter(Boolean));
  const base = includeSet.size > 0 ? EXAMPLE_FEATURE_KEYS.filter((key) => includeSet.has(key)) : [...EXAMPLE_FEATURE_KEYS];
  return base.filter((key) => !excludeSet.has(key));
}

function getSelectedFeatureManifests(selectedFeatures) {
  return starterManifest.exampleFeatures.filter((feature) =>
    selectedFeatures.includes(feature.key)
  );
}

function buildProfile({ coreOnly, selectedFeatures }) {
  if (coreOnly) return "core-only";
  if (selectedFeatures.length === 0) return "no-examples-selected";
  return "optional-examples";
}

export function buildScaffoldSummary({ appName, coreOnly = false, selectedFeatures = [] }) {
  const featureManifests = getSelectedFeatureManifests(selectedFeatures);
  const requiredBindings = Array.from(
    new Set([
      ...CORE_REQUIRED_BINDINGS,
      ...featureManifests.flatMap((feature) => feature.requiredBindings),
    ])
  );

  const nextSteps = [
    "Run npm install",
    "Run npm run db:migrate",
    "Optionally run npm run seed:demo for a local demo user",
    "Run npm run doctor",
    "Set real d1 database_id and queue name in wrangler.jsonc",
  ];

  if (requiredBindings.includes("KV")) {
    nextSteps.push("Create or wire the KV namespace, then set the KV binding in wrangler.jsonc");
  }

  if (requiredBindings.includes("BUCKET")) {
    nextSteps.push("Create or wire the R2 bucket, then set the BUCKET binding in wrangler.jsonc");
  }

  if (coreOnly) {
    nextSteps.push("Add your first domain feature under src/routes or src/features");
  } else if (selectedFeatures.length > 0) {
    nextSteps.push(`Decide whether to keep or replace: ${selectedFeatures.join(", ")}`);
  } else {
    nextSteps.push("Add the example features you need or replace them with domain features");
  }

  return {
    appName,
    mode: coreOnly ? "core-only" : "starter",
    profile: buildProfile({ coreOnly, selectedFeatures }),
    selectedFeatures,
    requiredBindings,
    nextSteps,
  };
}

function buildScaffoldFileChanges({ coreOnly, selectedFeatures }) {
  const filesRemoved = [...GENERATED_APP_REMOVED_PATHS];
  const filesRewritten = [
    "package.json",
    "wrangler.jsonc",
    "README.md",
    "app/App.tsx",
    ...GENERATED_APP_REWRITTEN_PATHS,
  ];

  if (coreOnly) {
    filesRemoved.push("examples/");
    filesRewritten.push("src/index.ts", "src/db/schema.ts", "app/pages/HomePage.tsx");
    return {
      filesRemoved,
      filesRewritten,
    };
  }

  for (const featureKey of EXAMPLE_FEATURE_KEYS) {
    if (selectedFeatures.includes(featureKey)) continue;
    filesRemoved.push(`examples/feature-packs/${featureKey}/`);
  }

  if (!selectedFeatures.includes("kv") && !selectedFeatures.includes("upload")) {
    filesRemoved.push("examples/lib/");
  }

  if (filesRemoved.length > 0) {
    filesRewritten.push("src/index.ts");
  }
  if (!selectedFeatures.includes("items")) {
    filesRewritten.push("app/App.tsx", "src/db/schema.ts", "app/pages/HomePage.tsx");
  }

  return {
    filesRemoved,
    filesRewritten: Array.from(new Set(filesRewritten)),
  };
}

function buildBindingChanges(requiredBindings) {
  const removableBindings = ["KV", "BUCKET"];
  return removableBindings.filter((binding) => !requiredBindings.includes(binding));
}

function buildRemovedBindingReasons(bindingsRemoved) {
  return Object.fromEntries(
    bindingsRemoved.map((binding) => [binding, REMOVABLE_BINDING_REASONS[binding]])
  );
}

function buildCoreBindingsKept(requiredBindings) {
  return CORE_REQUIRED_BINDINGS.filter((binding) => requiredBindings.includes(binding));
}

function buildCoreBindingReasons(coreBindingsKept) {
  return Object.fromEntries(
    coreBindingsKept.map((binding) => [binding, CORE_BINDING_REASONS[binding]])
  );
}

function buildScaffoldWarnings({ coreOnly, selectedFeatures, requiredBindings }) {
  const warnings = [];

  if (!selectedFeatures.includes("upload") && requiredBindings.includes("JOBS")) {
    warnings.push("JOBS binding remains required for invite, password reset, email verification, and welcome mail flows.");
  }
  if (coreOnly) {
    warnings.push("Core-only still keeps organization, auth, queue, and scheduled maintenance features.");
  }
  if (!coreOnly && selectedFeatures.length === 0) {
    warnings.push("No example features were selected. Consider using --core-only if you want a smaller starting point.");
  }
  if (selectedFeatures.includes("kv") && !selectedFeatures.includes("items")) {
    warnings.push("The kv example has no dedicated frontend hooks or schema; it is backend-only sample surface.");
  }

  return warnings;
}

export function buildScaffoldPlan({
  targetDir,
  appName = basename(targetDir),
  coreOnly = false,
  include = [],
  exclude = [],
} = {}) {
  validateProjectName(appName);
  validateFeatureList(include, "--include");
  validateFeatureList(exclude, "--exclude");

  const selectedFeatures = resolveSelectedFeatures({ coreOnly, include, exclude });
  const summary = buildScaffoldSummary({ appName, coreOnly, selectedFeatures });
  const removedFeatures = EXAMPLE_FEATURE_KEYS.filter(
    (featureKey) => !selectedFeatures.includes(featureKey)
  );
  const { filesRemoved, filesRewritten } = buildScaffoldFileChanges({
    coreOnly,
    selectedFeatures,
  });
  const bindingsRemoved = buildBindingChanges(summary.requiredBindings);
  const bindingRemovalReasons = buildRemovedBindingReasons(bindingsRemoved);
  const coreBindingsKept = buildCoreBindingsKept(summary.requiredBindings);
  const coreBindingReasons = buildCoreBindingReasons(coreBindingsKept);
  const warnings = buildScaffoldWarnings({
    coreOnly,
    selectedFeatures,
    requiredBindings: summary.requiredBindings,
  });
  const transforms = [];

  if (coreOnly) {
    transforms.push("Remove all example feature packs from examples/");
    transforms.push("Rewrite src/index.ts to keep only core routes");
    transforms.push("Replace app/App.tsx with the core-only starter UI");
  } else if (removedFeatures.length > 0) {
    transforms.push(`Remove example features: ${removedFeatures.join(", ")}`);
    transforms.push("Rewrite src/index.ts to mount only selected example routes");
    if (!selectedFeatures.includes("items")) {
      transforms.push("Remove the example items panel from app/App.tsx");
    }
  }

  transforms.push("Rewrite package.json, wrangler.jsonc, README.md, and app/App.tsx for the generated app name");
  transforms.push("Tailor README.md to selected features and required Cloudflare bindings");
  transforms.push("Remove starter-only scripts, tests, and docs from the generated app");
  transforms.push("Rewrite .github/workflows/ci.yml to the generated app baseline");

  return {
    targetDir,
    ...summary,
    removedFeatures,
    coreBindingsKept,
    coreBindingReasons,
    bindingsRemoved,
    bindingRemovalReasons,
    filesRemoved,
    filesRewritten,
    warnings,
    transforms,
  };
}

function renderSelectedFeaturesIntro(selectedFeatures) {
  if (selectedFeatures.length === 0) {
    return "- Core: 認証、セッション、権限、organization context、API 契約、DB、ログ、テスト、Cloudflare bindings\n- Optional Examples: なし";
  }

  return `- Core: 認証、セッション、権限、organization context、API 契約、DB、ログ、テスト、Cloudflare bindings\n- Optional Examples: ${selectedFeatures.map((feature) => `\`${feature}\``).join("、")}`;
}

function renderDeployBlock(requiredBindings) {
  const lines = [
    "```bash",
    "# 1. リソース作成",
    "wrangler d1 create my-app-db",
  ];

  if (requiredBindings.includes("KV")) {
    lines.push("wrangler kv namespace create KV");
  }
  if (requiredBindings.includes("BUCKET")) {
    lines.push("wrangler r2 bucket create my-app-bucket");
  }
  if (requiredBindings.includes("JOBS")) {
    lines.push("wrangler queues create my-app-jobs");
  }

  lines.push("");
  lines.push("# 2. wrangler.jsonc の bindings / ids を更新");
  lines.push("# 3. リモート DB へ migration 適用");
  lines.push("npm run db:migrate:remote");
  lines.push("");
  lines.push("# 4. デプロイ");
  lines.push("npm run deploy");
  lines.push("```");
  return lines;
}

function renderStackTable(requiredBindings) {
  const rows = [
    "| レイヤー | 技術 |",
    "|---|---|",
    "| Frontend | React + TypeScript + Tailwind CSS + TanStack Query |",
    "| Backend | Hono on Cloudflare Workers |",
    "| Database | D1 (SQLite) + Drizzle ORM |",
  ];

  if (requiredBindings.includes("BUCKET")) {
    rows.push("| Storage | R2 |");
  }
  if (requiredBindings.includes("KV")) {
    rows.push("| Cache | KV |");
  }

  rows.push("| Rate limit | Durable Object |");
  rows.push("| Async jobs | Cloudflare Queues |");
  rows.push("| Validation | Zod |");
  rows.push("| Build | Vite + `@cloudflare/vite-plugin` |");
  rows.push("| Testing | Vitest |");
  return rows;
}

function renderExampleFeatureTable(selectedFeatures) {
  const featureRows = {
    items: [
      "| `GET /api/items` | current organization の item 一覧 |",
      "| `POST /api/items` | current organization に item 作成 |",
    ],
    upload: [
      "| `GET /api/upload` | current organization prefix の R2 ファイル一覧取得 |",
      "| `POST /api/upload` | current organization prefix に R2 アップロード |",
    ],
    kv: [
      "| `GET /api/kv/:key` | current organization scope の KV 読み取り |",
      "| `PUT /api/kv/:key` | current organization scope の KV 書き込み |",
    ],
  };

  if (selectedFeatures.length === 0) {
    return ["この app は core-only 構成です。example feature API は含みません。"];
  }

  return [
    "| エンドポイント | 内容 |",
    "|---|---|",
    ...selectedFeatures.flatMap((feature) => featureRows[feature] ?? []),
  ];
}

function renderOptionalExamplesSection(selectedFeatures) {
  const lines = ["## Optional Examples", ""];

  if (selectedFeatures.length === 0) {
    lines.push("この app は core-first 構成です。optional example は含みません。");
    return lines.join("\n");
  }

  lines.push("この app には次の optional example を含めています。", "");

  if (selectedFeatures.includes("items")) {
    lines.push("- `items`: D1 + organization scope の最小 CRUD");
  }
  if (selectedFeatures.includes("kv")) {
    lines.push("- `kv`: organization scope の KV read/write");
  }
  if (selectedFeatures.includes("upload")) {
    lines.push("- `upload`: R2 upload/list と queue enqueue");
  }

  return lines.join("\n");
}

function renderProductionChecklist(requiredBindings) {
  const lines = ['- [ ] `wrangler.jsonc` の `database_id` を実値にする'];

  if (requiredBindings.includes("KV")) {
    lines.push('- [ ] `wrangler.jsonc` の KV binding を実値にする');
  }
  if (requiredBindings.includes("BUCKET")) {
    lines.push('- [ ] `wrangler.jsonc` の R2 binding を実値にする');
  }
  if (requiredBindings.includes("JOBS")) {
    lines.push('- [ ] `wrangler.jsonc` の Queue binding を実値にする');
  }

  lines.push('- [ ] `CORS_ORIGIN` を本番 origin にする');
  lines.push('- [ ] `COOKIE_SAME_SITE` / `COOKIE_SECURE` を運用に合わせる');
  lines.push('- [ ] Durable Object migration tag を必要に応じて更新する');
  if (requiredBindings.includes("JOBS")) {
    lines.push('- [ ] Queue 名を変更した場合は producer / consumer を揃える');
  }
  lines.push('- [ ] auth rate limit の閾値を要件に合わせる');
  lines.push('- [ ] `scheduled` cleanup が本番でも動くことを確認する');
  return lines;
}

function renderQueueSection(selectedFeatures) {
  const jobs = ["`user.welcome`"];
  if (selectedFeatures.includes("upload")) {
    jobs.push("`upload.process`");
  }

  const lines = [
    "`JOBS` Queue binding を持ち、core と optional examples の両方で job を enqueue します。",
    "",
    ...jobs.map((job) => `- ${job}`),
    "",
    "consumer は Worker module の `queue()` handler で処理します。",
    "",
    "organization invite 作成時には `organization.invite_email` job も enqueue されます。",
    "password reset request 時には `auth.password_reset_email` job も enqueue されます。",
    "signup と verification 再送時には `auth.email_verification_email` job も enqueue されます。",
    "`EMAIL_PROVIDER=resend`、`RESEND_API_KEY`、`EMAIL_FROM` を設定すると Resend 経由で実送信します。未設定時は `log` fallback です。",
  ];

  if (selectedFeatures.includes("upload")) {
    lines.push("");
    lines.push("`upload.process` は `upload` example feature に含まれる job です。");
  }

  return lines.join("\n");
}

function renderFeatureStructureSection(selectedFeatures, appName) {
  const lines = [
    "## Feature Structure",
    "",
    `\`${appName}\` は core と feature を分けて拡張する前提です。`,
    "",
    "- core routes: `src/routes/`",
    "- core hooks: `app/hooks/`",
    "- core schema: `shared/schemas/`",
  ];

  if (selectedFeatures.length === 0) {
    lines.push("- example features: なし");
  } else {
    lines.push(
      `- example feature routes: ${selectedFeatures.map((feature) => `\`examples/feature-packs/${feature}/server/routes.ts\``).join("、")}`
    );
    if (selectedFeatures.includes("items")) {
      lines.push("- example feature hooks: `examples/feature-packs/items/app/hooks/`");
      lines.push("- example feature schema: `examples/feature-packs/items/shared/`");
      lines.push("- example feature migrations: `migrations/0010_example_items.sql`");
    } else {
      lines.push("- example feature hooks: なし");
      lines.push("- example feature schema: なし");
      lines.push("- example feature migrations: なし");
    }
  }

  lines.push("");
  lines.push("新しい業務機能を追加する場合は、まず `core` へ入れるべき共通機能か、`example` や派生アプリ固有の feature かを分けてから配置してください。");
  if (selectedFeatures.length > 0) {
    lines.push("example feature であっても、業務テーブルは `organization_id` を持たせて current organization で絞るのを基本にします。");
  }

  return lines.join("\n");
}

function renderDirectoryStructureSection(selectedFeatures, appName) {
  const lines = ["## ディレクトリ構成", "", "```text", `${appName}/`, "├── app/                    React UI"];

  lines.push("│   ├── hooks/              core hooks");
  lines.push("│   └── lib/api.ts          型付き Hono RPC client");
  if (selectedFeatures.length > 0) {
    lines.push("├── examples/               selected example feature packs");
    lines.push("│   ├── feature-packs/      app / shared / server example code");
  }
  lines.push(
    selectedFeatures.includes("items")
      ? "├── migrations/             core + selected example migrations"
      : "├── migrations/             core migrations"
  );
  lines.push("├── shared/                 フロント・バック共有契約");
  lines.push("│   └── schemas/            core schema");
  lines.push("├── src/                    Worker backend");
  lines.push("│   ├── db/                 Drizzle schema");
  lines.push("│   ├── durable-objects/    rate limiter");
  lines.push("│   ├── lib/                auth, session, audit, organizations など");
  lines.push("│   ├── middleware/         auth, csrf, role, request-id");
  lines.push("│   ├── queues/             queue producer / consumer");
  lines.push("│   ├── routes/             core API routes");
  lines.push("│   └── index.ts            Worker entrypoint");
  lines.push("├── scripts/                補助スクリプト");
  lines.push("├── test/                   unit / integration tests");
  lines.push("└── README.md");
  lines.push("```");

  return lines.join("\n");
}

function renderGeneratedAppReadme({ appName, coreOnly, selectedFeatures, requiredBindings }) {
  const introHeading = coreOnly
    ? "このリポジトリは core-first 構成で始める前提です。"
    : "このリポジトリは core を中心に、必要な example だけを足す前提です。";
  const introBody = coreOnly
    ? "- Core: 認証、セッション、権限、organization context、API 契約、DB、ログ、テスト、Cloudflare bindings\n- Optional Examples: なし"
    : renderSelectedFeaturesIntro(selectedFeatures);

  const lines = [
    `# ${appName}`,
    "",
    "Cloudflare Workers 上で動く業務アプリの土台です。",
    "",
    "この生成先リポジトリは starter 本体ではなく、すぐに業務機能追加へ入るための app です。",
    "",
    introHeading,
    "",
    introBody,
    "",
    "## 何が入っているか",
    "",
    "- React + TypeScript + Tailwind CSS v4",
    "- Hono on Cloudflare Workers",
    "- D1 + Drizzle ORM",
    "- Zod による shared schema",
    "- Hono RPC client による型付き API 呼び出し",
    "- D1 session + HttpOnly Cookie 認証",
    "- CSRF 保護",
    "- request id",
    "- 構造化 JSON ログ",
    "- 統一 API エラー形式",
    "- Durable Object ベースの auth rate limit",
    "- organization / membership / current organization context",
    "- password reset request / confirm flow",
    "- email verification request / confirm flow",
    "- Vitest ベースの自動テスト",
    "",
    "## スタック",
    "",
    ...renderStackTable(requiredBindings),
    "",
    "## クイックスタート",
    "",
    "### 前提",
    "",
    "- Node.js 20+",
    "- npm",
    "- Wrangler CLI",
    "",
    "### ローカル開発",
    "",
    "```bash",
    "npm install",
    "npm run db:migrate",
    "npm run dev",
    "```",
    "",
    "### Cloudflare へデプロイ",
    "",
    ...renderDeployBlock(requiredBindings),
    "",
    "## コマンド",
    "",
    "| コマンド | 内容 |",
    "|---|---|",
    "| `npm run dev` | 統合開発モード |",
    "| `npm run dev:split` | Wrangler と Vite を分離起動 |",
    "| `npm run build` | ビルド |",
    "| `npm run preview` | ビルド後プレビュー |",
    "| `npm run deploy` | Cloudflare にデプロイ |",
    "| `npm test` | 自動テスト |",
    "| `npm run test:watch` | テスト watch |",
    "| `npm run db:generate` | Drizzle から migration 生成 |",
    "| `npm run db:migrate` | ローカル D1 に migration 適用 |",
    "| `npm run db:migrate:remote` | リモート D1 に migration 適用 |",
    "| `npm run seed:demo` | ローカル D1 に demo user を投入 |",
    "| `npm run doctor` | generated app としての整合性チェック |",
    "| `npm run record:generate -- --record shared/records/xxx.ts` | Record Engine でコード生成 |",
    "",
    renderOptionalExamplesSection(selectedFeatures),
    "",
    renderDirectoryStructureSection(selectedFeatures, appName),
    "",
    "## Core API",
    "",
    "| エンドポイント | 内容 |",
    "|---|---|",
    "| `GET /api/health` | DB / KV / R2 / Env の基本チェック |",
    "| `GET /api/modules` | core / optional module の runtime status |",
    "| `GET /api/orgs` | 所属 organization 一覧と current organization |",
    "| `POST /api/orgs` | organization 作成 + current organization 切替 |",
    "| `GET /api/orgs/current/invites` | current organization の招待一覧 |",
    "| `POST /api/orgs/current/invites` | current organization の招待作成 |",
    "| `POST /api/orgs/invites/accept` | organization 招待承諾 |",
    "| `POST /api/auth/signup` | ユーザー登録 |",
    "| `POST /api/auth/login` | ログイン |",
    "| `POST /api/auth/logout` | ログアウト |",
    "| `POST /api/auth/switch-org` | current organization 切替 |",
    "| `POST /api/auth/password-reset/request` | password reset 開始 |",
    "| `POST /api/auth/password-reset/confirm` | password reset 完了 |",
    "| `POST /api/auth/email-verification/request` | verification mail 再送 |",
    "| `POST /api/auth/email-verification/confirm` | email verification 完了 |",
    "| `GET /api/auth/me` | 現在のユーザー取得 |",
    "",
    "## Security Invariants",
    "",
    "- session cookie は HttpOnly",
    "- パスワードは PBKDF2 で保存",
    "- write 系 API は CSRF 保護",
    "- auth API は rate limit 付き",
    "- すべてのエラーは `{ error: { code, message, requestId, details? } }`",
    "- 監査ログは `audit_logs` に保存",
    "- `X-Request-Id` をレスポンスとログに載せる",
    "- organization context は `memberships` と `sessions.current_org_id` で解決",
    "",
    "## Queue",
    "",
    renderQueueSection(selectedFeatures),
    "",
    renderFeatureStructureSection(selectedFeatures, appName),
    "",
    "## Optional Example APIs",
    "",
    ...renderExampleFeatureTable(selectedFeatures),
    "",
    "## 本番チェックリスト",
    "",
    ...renderProductionChecklist(requiredBindings),
  ];

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function stripItemsPanelFromApp(source) {
  return source
    .replace(/\/\/ scaffold:items-import:start\n[\s\S]*?\/\/ scaffold:items-import:end\n/g, "")
    .replace(/\/\/ scaffold:items-state:start\n[\s\S]*?\/\/ scaffold:items-state:end\n/g, "")
    .replace(/\/\/ scaffold:items-hooks:start\n[\s\S]*?\/\/ scaffold:items-hooks:end\n/g, "")
    .replace(/\s*\{\/\* scaffold:items-panel:start \*\/\}[\s\S]*?\{\/\* scaffold:items-panel:end \*\/\}\n?/g, "");
}

function stripItemsSchemaFromDb(source) {
  return source.replace(
    /\/\/ scaffold:items-schema:start\n[\s\S]*?\/\/ scaffold:items-schema:end\n?/g,
    ""
  );
}

function buildGenericHomePage(appName) {
  const displayName = toDisplayName(appName);
  return `import { Panel } from "../components/Panel";

export function HomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-white">Welcome to ${displayName}</h1>
      <Panel title="Starter Core" subtitle="Add your own feature packs or Record Engine records here.">
        <p className="text-sm text-slate-300">
          This app was generated without the example items feature.
        </p>
      </Panel>
    </div>
  );
}
`;
}

async function rewriteIndexForSelectedFeatures(indexPath, selectedFeatures) {
  const source = await readFile(indexPath, "utf8");
  const featurePatterns = {
    items: [
      'import items from "../examples/feature-packs/items/server/routes";',
      '.route("/api/items", items)',
    ],
    kv: [
      'import kv from "../examples/feature-packs/kv/server/routes";',
      '.route("/api/kv", kv)',
    ],
    upload: [
      'import upload from "../examples/feature-packs/upload/server/routes";',
      '.route("/api/upload", upload)',
    ],
  };

  const updated = source
    .split("\n")
    .filter((line) =>
      EXAMPLE_FEATURE_KEYS.every((featureKey) => {
        if (selectedFeatures.includes(featureKey)) return true;
        return !featurePatterns[featureKey].some((pattern) => line.includes(pattern));
      })
    )
    .join("\n");

  await writeFile(indexPath, updated);
}

async function rewriteAppForSelectedFeatures(appPath, selectedFeatures) {
  if (!(await pathExists(appPath))) {
    return;
  }

  let source = await readFile(appPath, "utf8");

  if (!selectedFeatures.includes("items")) {
    source = stripItemsPanelFromApp(source);
  }

  await writeFile(appPath, source);
}

async function rewriteDbSchemaForSelectedFeatures(schemaPath, selectedFeatures) {
  if (!(await pathExists(schemaPath))) {
    return;
  }

  let source = await readFile(schemaPath, "utf8");

  if (!selectedFeatures.includes("items")) {
    source = stripItemsSchemaFromDb(source);
  }

  await writeFile(schemaPath, source);
}

async function rewriteHomePageForSelectedFeatures(homePagePath, appName, selectedFeatures) {
  if (!(await pathExists(homePagePath))) {
    return;
  }

  if (!selectedFeatures.includes("items")) {
    await writeFile(homePagePath, buildGenericHomePage(appName));
  }
}

export async function applyFeatureSelection(targetDir, selectedFeatures) {
  for (const featureKey of EXAMPLE_FEATURE_KEYS) {
    if (selectedFeatures.includes(featureKey)) continue;

    await rm(join(targetDir, "examples/feature-packs", featureKey), {
      recursive: true,
      force: true,
    });
  }

  if (!selectedFeatures.includes("kv") && !selectedFeatures.includes("upload")) {
    await rm(join(targetDir, "examples/lib"), { recursive: true, force: true });
  }
  if (!selectedFeatures.includes("items")) {
    await rm(join(targetDir, "migrations/0010_example_items.sql"), { force: true });
  }

  await rewriteIndexForSelectedFeatures(join(targetDir, "src/index.ts"), selectedFeatures);
  await rewriteAppForSelectedFeatures(join(targetDir, "app/App.tsx"), selectedFeatures);
  await rewriteDbSchemaForSelectedFeatures(join(targetDir, "src/db/schema.ts"), selectedFeatures);
  await rewriteHomePageForSelectedFeatures(
    join(targetDir, "app/pages/HomePage.tsx"),
    basename(targetDir),
    selectedFeatures
  );
}

export async function rewriteScaffoldMetadata(
  targetDir,
  appName,
  { coreOnly = false, selectedFeatures = [], requiredBindings = CORE_REQUIRED_BINDINGS } = {}
) {
  const displayName = toDisplayName(appName);

  const packageJsonPath = join(targetDir, "package.json");
  if (await pathExists(packageJsonPath)) {
    await rewriteTextFile(packageJsonPath, (source) => {
      const parsed = JSON.parse(source);
      parsed.name = appName;
      parsed.private = true;
      parsed.description = `${displayName} application scaffolded from cf-starter.`;
      delete parsed.bin;
      delete parsed.files;
      delete parsed.publishConfig;
      delete parsed.homepage;
      delete parsed.repository;
      delete parsed.bugs;
      delete parsed.keywords;
      if (parsed.scripts) {
        parsed.scripts.doctor ??= "node scripts/doctor.mjs";
        parsed.scripts["seed:demo"] ??= "node scripts/seed-demo.mjs";
        const removeScripts = [
          "check:publish",
          "test:create",
          "modules:plan",
          "modules:plan:json",
          "app:plan",
          "app:plan:core",
          "app:plan:json",
          "app:plan:core:json",
          "app:scaffold",
        ];
        for (const key of removeScripts) {
          delete parsed.scripts[key];
        }
      }
      return `${JSON.stringify(parsed, null, 2)}\n`;
    });
  }

  const wranglerPath = join(targetDir, "wrangler.jsonc");
  if (await pathExists(wranglerPath)) {
    await rewriteTextFile(wranglerPath, (source) =>
      {
        let updated = source
        .replace(/"name":\s*"cf-starter"/, `"name": "${appName}"`)
        .replace(/"database_name":\s*"cf-starter-db"/, `"database_name": "${appName}-db"`)
        .replace(/"bucket_name":\s*"cf-starter-bucket"/, `"bucket_name": "${appName}-bucket"`)
        .replace(/"queue":\s*"cf-starter-jobs"/g, `"queue": "${appName}-jobs"`)
        .replace(/"EMAIL_FROM":\s*"cf-starter <noreply@example.com>"/, `"EMAIL_FROM": "${appName} <noreply@example.com>"`);

        if (!requiredBindings.includes("KV")) {
          updated = removeJsoncPropertyBlock(updated, "kv_namespaces");
        }
        if (!requiredBindings.includes("BUCKET")) {
          updated = removeJsoncPropertyBlock(updated, "r2_buckets");
        }

        return updated.replace(/\n{3,}/g, "\n\n");
      }
    );
  }

  const readmePath = join(targetDir, "README.md");
  if (await pathExists(readmePath)) {
    await writeFile(
      readmePath,
      renderGeneratedAppReadme({
        appName,
        coreOnly,
        selectedFeatures,
        requiredBindings,
      })
    );
  }

  const appPath = join(targetDir, "app/App.tsx");
  if (await pathExists(appPath)) {
    await rewriteTextFile(appPath, (source) =>
      source.replaceAll("cf-starter", appName).replaceAll("Starter Core", displayName)
    );
  }
}

async function ensureTargetReady(targetDir, { force }) {
  try {
    const info = await stat(targetDir);
    if (!info.isDirectory()) {
      throw buildValidationError(`Target exists and is not a directory: ${targetDir}`);
    }
    if (force) {
      await rm(targetDir, { recursive: true, force: true });
      await mkdir(targetDir, { recursive: true });
      return { createdByScaffold: true };
    }
    throw buildValidationError(
      `Refusing to overwrite existing directory: ${targetDir}. Use a new target path.`
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      await mkdir(targetDir, { recursive: true });
      return { createdByScaffold: true };
    }
    throw error;
  }
}

export async function rewriteIndexForCoreOnly(indexPath) {
  const source = await readFile(indexPath, "utf8");
  const updated = source
    .split("\n")
    .filter(
      (line) =>
        !line.includes('examples/feature-packs/items/server/routes') &&
        !line.includes('examples/feature-packs/kv/server/routes') &&
        !line.includes('examples/feature-packs/upload/server/routes') &&
        !line.includes('.route("/api/items", items)') &&
        !line.includes('.route("/api/kv", kv)') &&
        !line.includes('.route("/api/upload", upload)')
    )
    .join("\n");
  await writeFile(indexPath, updated);
}

export async function applyCoreOnlyTransforms(targetDir) {
  await rm(join(targetDir, "examples"), { recursive: true, force: true });
  await rm(join(targetDir, "migrations/0010_example_items.sql"), { force: true });
  await rm(join(targetDir, "app/pages/HomePage.tsx"), { force: true });
  await rewriteIndexForCoreOnly(join(targetDir, "src/index.ts"));
  await rewriteDbSchemaForSelectedFeatures(join(targetDir, "src/db/schema.ts"), []);
}

async function removeStarterOnlyGeneratedFiles(targetDir) {
  for (const relativePath of GENERATED_APP_REMOVED_PATHS) {
    await rm(join(targetDir, relativePath), { recursive: true, force: true });
  }
}

async function rewriteGeneratedAppCiWorkflow(workflowPath) {
  if (!(await pathExists(workflowPath))) {
    return;
  }

  await rewriteTextFile(workflowPath, (source) =>
    source
      .replace(
        /\n\s+- name: Check publish readiness[\s\S]*?\n\s+run: npm run check:publish\n/g,
        "\n"
      )
      .replace(
        /\n\s+- name: Scaffold integration test[\s\S]*?\n\s+timeout-minutes: 10\n/g,
        "\n"
      )
      .replace(/\n{3,}/g, "\n\n")
  );
}

export async function writeCoreOnlyApp(targetDir, appName) {
  await writeFile(join(targetDir, "app/App.tsx"), buildCoreOnlyAppTemplate(appName));
}

export async function scaffoldStarter({
  sourceDir,
  targetDir,
  appName = basename(targetDir),
  coreOnly = false,
  include = [],
  exclude = [],
  force = false,
}) {
  const { createdByScaffold } = await ensureTargetReady(targetDir, { force });

  try {
    await cp(sourceDir, targetDir, {
      recursive: true,
      filter: (sourcePath) => shouldCopy(sourcePath.replace(sourceDir, "")),
    });

    const plan = buildScaffoldPlan({ targetDir, appName, coreOnly, include, exclude });
    const { selectedFeatures } = plan;

    if (coreOnly) {
      await applyCoreOnlyTransforms(targetDir);
      await writeCoreOnlyApp(targetDir, appName);
    } else {
      await applyFeatureSelection(targetDir, selectedFeatures);
      await materializeFeatureMigrations({
        sourceDir: targetDir,
        targetDir,
        selectedFeatures,
      });
    }

    await removeStarterOnlyGeneratedFiles(targetDir);
    await rewriteScaffoldMetadata(targetDir, appName, plan);
    await rewriteGeneratedAppCiWorkflow(join(targetDir, ".github/workflows/ci.yml"));

    return {
      ...plan,
    };
  } catch (error) {
    if (createdByScaffold) {
      await rm(targetDir, { recursive: true, force: true });
    }
    throw error;
  }
}
