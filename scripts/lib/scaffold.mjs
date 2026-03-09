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

export async function rewriteScaffoldMetadata(targetDir, appName) {
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
      source
        .replace(/"name":\s*"cf-starter"/, `"name": "${appName}"`)
        .replace(/"database_name":\s*"cf-starter-db"/, `"database_name": "${appName}-db"`)
        .replace(/"bucket_name":\s*"cf-starter-bucket"/, `"bucket_name": "${appName}-bucket"`)
        .replace(/"queue":\s*"cf-starter-jobs"/g, `"queue": "${appName}-jobs"`)
        .replace(/"EMAIL_FROM":\s*"cf-starter <noreply@example.com>"/, `"EMAIL_FROM": "${appName} <noreply@example.com>"`)
    );
  }

  const readmePath = join(targetDir, "README.md");
  if (await pathExists(readmePath)) {
    await rewriteTextFile(readmePath, (source) => {
      const lines = source.split("\n");
      if (lines[0] === "# cf-starter") {
        lines[0] = `# ${appName}`;
      }
      return lines
        .join("\n")
        .replaceAll("`cf-starter`", `\`${appName}\``)
        .replace("cf-starter/", `${appName}/`);
    });
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

  const selectedFeatures = resolveSelectedFeatures({ coreOnly, include, exclude });

  if (coreOnly) {
    await applyCoreOnlyTransforms(targetDir);
    await writeCoreOnlyApp(targetDir, appName);
  } else {
    await applyFeatureSelection(targetDir, selectedFeatures);
  }

  await rewriteScaffoldMetadata(targetDir, appName);

  return {
    targetDir,
    appName,
    mode: coreOnly ? "core-only" : "starter",
    selectedFeatures,
  };
}
