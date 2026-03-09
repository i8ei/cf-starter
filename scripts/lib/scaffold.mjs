import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { starterManifest } from "./starter-manifest.mjs";

const COPY_EXCLUDES = new Set([
  ".git",
  "node_modules",
  "dist",
  ".wrangler",
]);

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

const CORE_ONLY_APP_TEMPLATE = `import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useHealth } from "./hooks/useHealth";
import {
  useAcceptOrganizationInvite,
  useCreateOrganization,
  useCreateOrganizationInvite,
  useLogin,
  useLogout,
  useOrganizationInvites,
  useOrganizations,
  useSession,
  useSignup,
  useSwitchOrganization,
} from "./hooks/useSession";

const queryClient = new QueryClient();

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function AuthPanel() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const signup = useSignup();
  const mutation = mode === "login" ? login : signup;

  const submit = () => {
    if (mode === "login") {
      login.mutate({ email, password });
      return;
    }
    signup.mutate({ name, email, password });
  };

  return (
    <Panel title="Authentication">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("login")}
          className="rounded-full bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950"
        >
          login
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-slate-300"
        >
          signup
        </button>
      </div>
      <div className="space-y-3">
        {mode === "signup" ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
          />
        ) : null}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={mutation.isPending}
          className="w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          {mode === "login" ? "Log In" : "Create Account"}
        </button>
        {mutation.error ? (
          <p className="text-sm text-rose-300">{mutation.error.message}</p>
        ) : (
          <p className="text-sm text-slate-400">
            Core-only starter: auth と organization context の最小 UI です。
          </p>
        )}
      </div>
    </Panel>
  );
}

function Dashboard() {
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteToken, setInviteToken] = useState("");
  const [latestToken, setLatestToken] = useState<string | null>(null);
  const { data: health } = useHealth();
  const { data: session, isLoading } = useSession();
  const { data: organizations } = useOrganizations(!!session);
  const { data: invites } = useOrganizationInvites(!!session);
  const createOrganization = useCreateOrganization();
  const switchOrganization = useSwitchOrganization();
  const createInvite = useCreateOrganizationInvite();
  const acceptInvite = useAcceptOrganizationInvite();
  const logout = useLogout();

  if (isLoading) {
    return <div className="p-8 text-slate-300">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-[2rem] border border-white/10 bg-slate-900 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Core Only</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">__APP_DISPLAY_NAME__</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            Authentication, organization context, invite lifecycle, queue-driven mail.
          </p>
        </header>

        {health?.checks ? (
          <div className="flex flex-wrap gap-2">
            {Object.entries(health.checks).map(([key, value]) => (
              <span
                key={key}
                className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300"
              >
                {key}: {value}
              </span>
            ))}
          </div>
        ) : null}

        {!session ? (
          <AuthPanel />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <Panel title="Organizations">
                <div className="space-y-2">
                  {organizations?.organizations.map((organization) => (
                    <button
                      key={organization.organizationId}
                      type="button"
                      onClick={() => switchOrganization.mutate(organization.organizationId)}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-left"
                    >
                      <span>
                        <span className="block text-white">
                          {organization.organizationName}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {organization.organizationSlug}
                        </span>
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-300">
                        {organization.membershipRole}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="New organization"
                    className="flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      createOrganization.mutate(orgName, {
                        onSuccess: () => setOrgName(""),
                      })
                    }
                    className="rounded-2xl bg-amber-400 px-4 py-3 font-semibold text-slate-950"
                  >
                    Create
                  </button>
                </div>
              </Panel>

              <Panel title="Invites">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      createInvite.mutate(
                        { email: inviteEmail, role: inviteRole },
                        { onSuccess: (data) => setLatestToken(data.invite.token) }
                      )
                    }
                    className="rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950"
                  >
                    Invite
                  </button>
                </div>
                {latestToken ? (
                  <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 font-mono text-sm text-amber-100">
                    {latestToken}
                  </div>
                ) : null}
                <div className="mt-4 space-y-2">
                  {invites?.invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3"
                    >
                      <div className="text-white">{invite.email}</div>
                      <div className="text-xs text-slate-400">
                        {invite.role} · {invite.status}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <input
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder="Invite token"
                    className="flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => acceptInvite.mutate(inviteToken)}
                    className="rounded-2xl bg-fuchsia-300 px-4 py-3 font-semibold text-slate-950"
                  >
                    Accept
                  </button>
                </div>
              </Panel>
            </div>

            <div className="space-y-6">
              <Panel title="Session">
                <div className="space-y-2 text-sm text-slate-300">
                  <div>name: {session.name}</div>
                  <div>email: {session.email}</div>
                  <div>currentOrg: {session.currentOrganizationId}</div>
                  <div>organizationRole: {session.organizationRole}</div>
                  <div>roles: {session.roles.join(", ")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => logout.mutate()}
                  className="mt-4 rounded-2xl bg-rose-400 px-4 py-3 font-semibold text-slate-950"
                >
                  Log Out
                </button>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
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
    "Set real Cloudflare resource IDs in wrangler.jsonc",
  ];

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
    selectedFeatures,
    requiredBindings,
    nextSteps,
  };
}

function buildScaffoldFileChanges({ coreOnly, selectedFeatures }) {
  const filesRemoved = [];
  const filesRewritten = [
    "package.json",
    "wrangler.jsonc",
    "README.md",
    "app/App.tsx",
  ];

  if (coreOnly) {
    filesRemoved.push(
      "src/features/example/",
      "app/features/example/",
      "shared/features/example/"
    );
    filesRewritten.push("src/index.ts");
    return {
      filesRemoved,
      filesRewritten,
    };
  }

  for (const featureKey of EXAMPLE_FEATURE_KEYS) {
    if (selectedFeatures.includes(featureKey)) continue;
    filesRemoved.push(
      `src/features/example/${featureKey}/`,
      `app/features/example/${featureKey}/`,
      `shared/features/example/${featureKey}/`
    );
  }

  if (filesRemoved.length > 0) {
    filesRewritten.push("src/index.ts");
  }
  if (!selectedFeatures.includes("items")) {
    filesRewritten.push("app/App.tsx");
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
    transforms.push("Remove all example features from src/features/example, app/features/example, and shared/features/example");
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

function replaceSectionBetweenMarkers(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start === -1) return source;

  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) {
    return `${source.slice(0, start)}${replacement}\n`;
  }

  return `${source.slice(0, start)}${replacement}\n${source.slice(end)}`;
}

function renderSelectedFeaturesIntro(selectedFeatures) {
  if (selectedFeatures.length === 0) {
    return "- Starter Core: 認証、セッション、権限、organization context、API 契約、DB、ログ、テスト、Cloudflare bindings\n- Example Features: なし";
  }

  return `- Starter Core: 認証、セッション、権限、organization context、API 契約、DB、ログ、テスト、Cloudflare bindings\n- Example Features: ${selectedFeatures.map((feature) => `\`${feature}\``).join("、")}`;
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
    "## Queue",
    "",
    "`JOBS` Queue binding を持ち、現在は sample job として次を enqueue します。",
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

  return lines.join("\n");
}

function renderFeatureStructureSection(selectedFeatures) {
  const lines = [
    "## Feature Structure",
    "",
    "`cf-starter` は段階的に feature-based structure へ寄せています。",
    "",
    "- core routes: `src/routes/`",
    "- core hooks: `app/hooks/`",
    "- core schema: `shared/schemas/`",
  ];

  if (selectedFeatures.length === 0) {
    lines.push("- example features: なし");
  } else {
    lines.push(
      `- example feature routes: ${selectedFeatures.map((feature) => `\`src/features/example/${feature}/routes.ts\``).join("、")}`
    );
    if (selectedFeatures.includes("items")) {
      lines.push("- example feature hooks: `app/features/example/items/hooks/`");
      lines.push("- example feature schema: `shared/features/example/items/`");
    } else {
      lines.push("- example feature hooks: なし");
      lines.push("- example feature schema: なし");
    }
  }

  lines.push("");
  lines.push("新しい業務機能を追加する場合は、まず `core` へ入れるべき共通機能か、`example` や派生アプリ固有の feature かを分けてから配置してください。");
  if (selectedFeatures.length > 0) {
    lines.push("example feature であっても、業務テーブルは `organization_id` を持たせて current organization で絞るのを基本にします。");
  }

  return lines.join("\n");
}

function renderDirectoryStructureSection(selectedFeatures) {
  const lines = ["## ディレクトリ構成", "", "```text", "cf-starter/", "├── app/                    React UI"];

  if (selectedFeatures.length > 0) {
    lines.push("│   ├── features/example/   selected example feature hooks");
  }
  lines.push("│   ├── hooks/              core hooks");
  lines.push("│   └── lib/api.ts          型付き Hono RPC client");
  lines.push("├── shared/                 フロント・バック共有契約");
  if (selectedFeatures.length > 0) {
    lines.push("│   ├── features/example/   selected example feature schema");
  }
  lines.push("│   └── schemas/            core schema");
  lines.push("├── src/                    Worker backend");
  lines.push("│   ├── db/                 Drizzle schema");
  lines.push("│   ├── durable-objects/    rate limiter");
  if (selectedFeatures.length > 0) {
    lines.push("│   ├── features/example/   selected example feature routes");
  }
  lines.push("│   ├── lib/                auth, session, audit, organizations など");
  lines.push("│   ├── middleware/         auth, csrf, role, request-id");
  lines.push("│   ├── queues/             queue producer / consumer");
  lines.push("│   ├── routes/             core API routes");
  lines.push("│   └── index.ts            Worker entrypoint");
  lines.push("├── migrations/             D1 migrations");
  lines.push("├── scripts/                補助スクリプト");
  lines.push("├── test/                   unit / integration tests");
  lines.push("├── ARCHITECTURE.md");
  lines.push("├── ROADMAP.md");
  lines.push("└── README.md");
  lines.push("```");

  return lines.join("\n");
}

function tailorReadmeForScaffold(source, { appName, coreOnly, selectedFeatures, requiredBindings }) {
  const lines = source.split("\n");
  if (lines[0] === "# cf-starter") {
    lines[0] = `# ${appName}`;
  }

  let updated = lines
    .join("\n")
    .replaceAll("`cf-starter`", `\`${appName}\``)
    .replace("cf-starter/", `${appName}/`)
    .replace(
      "- Starter Core: 認証、セッション、権限、organization context、API 契約、DB、ログ、テスト、Cloudflare bindings\n- Example Features: `items`、`kv`、`upload` のような最小サンプル",
      renderSelectedFeaturesIntro(selectedFeatures)
    );

  updated = replaceSectionBetweenMarkers(
    updated,
    "### Cloudflare へデプロイ\n",
    "\n## コマンド\n",
    `### Cloudflare へデプロイ\n\n${renderDeployBlock(requiredBindings).join("\n")}`
  );
  updated = replaceSectionBetweenMarkers(
    updated,
    "## Example Feature API\n",
    "\n## Security Invariants\n",
    `## Example Feature API\n\n${renderExampleFeatureTable(selectedFeatures).join("\n")}`
  );
  updated = replaceSectionBetweenMarkers(
    updated,
    "## スタック\n",
    "\n## クイックスタート\n",
    `## スタック\n\n${renderStackTable(requiredBindings).join("\n")}`
  );
  updated = replaceSectionBetweenMarkers(
    updated,
    "## 本番チェックリスト\n",
    "\n## 現在の不足\n",
    `## 本番チェックリスト\n\n${renderProductionChecklist(requiredBindings).join("\n")}`
  );
  updated = replaceSectionBetweenMarkers(
    updated,
    "## ディレクトリ構成\n",
    "\n## Core API\n",
    renderDirectoryStructureSection(selectedFeatures)
  );
  updated = replaceSectionBetweenMarkers(
    updated,
    "## Queue\n",
    "\n## Module Plan\n",
    renderQueueSection(selectedFeatures)
  );
  updated = replaceSectionBetweenMarkers(
    updated,
    "## Feature Structure\n",
    "\n## 開発の流れ\n",
    renderFeatureStructureSection(selectedFeatures)
  );

  if (coreOnly) {
    updated = updated.replace(
      "このリポジトリは 2 層で考えます。",
      "このリポジトリは core-only 構成で始める前提です。"
    );
  }

  return updated;
}

function stripItemsPanelFromApp(source) {
  return source
    .replace(
      'import {\n  useItems,\n  useCreateItem,\n} from "./features/example/items/hooks/useItems";\n',
      ""
    )
    .replace('  const [name, setName] = useState("");\n', "")
    .replace('  const { data: items = [], isLoading } = useItems(!!session);\n', "")
    .replace('  const createItem = useCreateItem();\n', "")
    .replace(
      [
        "  const handleAdd = () => {",
        '    if (!name.trim()) return;',
        "    createItem.mutate(name.trim());",
        '    setName("");',
        "  };",
        "",
      ].join("\n"),
      ""
    )
    .replace(
      /\s*<Panel\s+title="D1 Items"[\s\S]*?<\/Panel>\n?/,
      ""
    );
}

async function rewriteIndexForSelectedFeatures(indexPath, selectedFeatures) {
  const source = await readFile(indexPath, "utf8");
  const featurePatterns = {
    items: [
      'import items from "./features/example/items/routes";',
      '.route("/api/items", items)',
    ],
    kv: [
      'import kv from "./features/example/kv/routes";',
      '.route("/api/kv", kv)',
    ],
    upload: [
      'import upload from "./features/example/upload/routes";',
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

export async function applyFeatureSelection(targetDir, selectedFeatures) {
  for (const featureKey of EXAMPLE_FEATURE_KEYS) {
    if (selectedFeatures.includes(featureKey)) continue;

    await rm(join(targetDir, "src/features/example", featureKey), {
      recursive: true,
      force: true,
    });
    await rm(join(targetDir, "app/features/example", featureKey), {
      recursive: true,
      force: true,
    });
    await rm(join(targetDir, "shared/features/example", featureKey), {
      recursive: true,
      force: true,
    });
  }

  await rewriteIndexForSelectedFeatures(join(targetDir, "src/index.ts"), selectedFeatures);
  await rewriteAppForSelectedFeatures(join(targetDir, "app/App.tsx"), selectedFeatures);
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
    await rewriteTextFile(readmePath, (source) =>
      tailorReadmeForScaffold(source, {
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
      throw new Error(`Target exists and is not a directory: ${targetDir}`);
    }
    if (force) {
      await rm(targetDir, { recursive: true, force: true });
      await mkdir(targetDir, { recursive: true });
      return;
    }
    throw new Error(`Target already exists: ${targetDir}`);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      await mkdir(targetDir, { recursive: true });
      return;
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
        !line.includes('features/example/items/routes') &&
        !line.includes('features/example/kv/routes') &&
        !line.includes('features/example/upload/routes') &&
        !line.includes('.route("/api/items", items)') &&
        !line.includes('.route("/api/kv", kv)') &&
        !line.includes('.route("/api/upload", upload)')
    )
    .join("\n");
  await writeFile(indexPath, updated);
}

export async function applyCoreOnlyTransforms(targetDir) {
  await rm(join(targetDir, "src/features/example"), { recursive: true, force: true });
  await rm(join(targetDir, "app/features/example"), { recursive: true, force: true });
  await rm(join(targetDir, "shared/features/example"), { recursive: true, force: true });
  await rewriteIndexForCoreOnly(join(targetDir, "src/index.ts"));
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
  await ensureTargetReady(targetDir, { force });
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
  }

  await rewriteScaffoldMetadata(targetDir, appName, plan);

  return {
    ...plan,
  };
}
