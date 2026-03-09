import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// scaffold:items-import:start
import {
  useItems,
  useCreateItem,
} from "./features/example/items/hooks/useItems";
// scaffold:items-import:end
import { useHealth } from "./hooks/useHealth";
import {
  useAcceptOrganizationInvite,
  useConfirmEmailVerification,
  useConfirmPasswordReset,
  useCreateOrganization,
  useCreateOrganizationInvite,
  useLogin,
  useLogout,
  useOrganizationInvites,
  useRequestEmailVerification,
  useRequestPasswordReset,
  useOrganizations,
  useSession,
  useSignup,
  useSwitchOrganization,
} from "./hooks/useSession";

const queryClient = new QueryClient();

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function AuthPanel() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("resetToken") ?? "";
  });
  const [verifyToken, setVerifyToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("verifyToken") ?? "";
  });
  const [nextPassword, setNextPassword] = useState("");
  const login = useLogin();
  const signup = useSignup();
  const requestPasswordReset = useRequestPasswordReset();
  const confirmPasswordReset = useConfirmPasswordReset();
  const requestEmailVerification = useRequestEmailVerification();
  const confirmEmailVerification = useConfirmEmailVerification();

  const currentMutation = mode === "login" ? login : signup;

  const handleSubmit = () => {
    if (mode === "login") {
      login.mutate({ email, password });
      return;
    }
    signup.mutate({ email, password, name });
  };

  const handleRequestReset = () => {
    if (!resetEmail.trim()) return;
    requestPasswordReset.mutate(resetEmail.trim());
  };

  const handleConfirmReset = () => {
    if (!resetToken.trim() || !nextPassword.trim()) return;
    confirmPasswordReset.mutate(
      { token: resetToken.trim(), password: nextPassword },
      {
        onSuccess: () => {
          setResetToken("");
          setNextPassword("");
        },
      }
    );
  };

  const handleConfirmEmailVerification = () => {
    if (!verifyToken.trim()) return;
    confirmEmailVerification.mutate(verifyToken.trim(), {
      onSuccess: () => {
        setVerifyToken("");
      },
    });
  };

  return (
    <Panel
      title="Authentication"
      subtitle="Starter core の認証、personal workspace、password reset をそのまま確認できます。"
    >
      <div className="mb-4 flex gap-2">
        {(["login", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              mode === value
                ? "bg-amber-400 text-slate-950"
                : "bg-white/5 text-slate-300"
            }`}
          >
            {value}
          </button>
        ))}
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
          onClick={handleSubmit}
          disabled={currentMutation.isPending}
          className="w-full rounded-2xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          {mode === "login" ? "Log In" : "Create Account"}
        </button>
        {currentMutation.error ? (
          <p className="text-sm text-rose-300">{currentMutation.error.message}</p>
        ) : (
          <p className="text-sm text-slate-400">
            Login すると current organization context が有効になります。
          </p>
        )}
      </div>
      <div className="mt-6 grid gap-4 border-t border-white/10 pt-5 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Request Password Reset</div>
          <input
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleRequestReset}
            disabled={requestPasswordReset.isPending}
            className="w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            Send Reset Link
          </button>
          {requestPasswordReset.error ? (
            <p className="text-sm text-rose-300">
              {requestPasswordReset.error.message}
            </p>
          ) : requestPasswordReset.isSuccess ? (
            <p className="text-sm text-emerald-300">
              If the account exists, a reset email job was queued.
            </p>
          ) : null}
        </div>
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Confirm Password Reset</div>
          <input
            value={resetToken}
            onChange={(e) => setResetToken(e.target.value)}
            placeholder="Reset token"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
          />
          <input
            type="password"
            value={nextPassword}
            onChange={(e) => setNextPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleConfirmReset}
            disabled={confirmPasswordReset.isPending}
            className="w-full rounded-2xl bg-fuchsia-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            Reset Password
          </button>
          {confirmPasswordReset.error ? (
            <p className="text-sm text-rose-300">
              {confirmPasswordReset.error.message}
            </p>
          ) : confirmPasswordReset.isSuccess ? (
            <p className="text-sm text-emerald-300">
              Password updated. Log in with the new password.
            </p>
          ) : null}
        </div>
        <div className="space-y-3">
          <div className="text-sm font-medium text-white">Confirm Email</div>
          <input
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value)}
            placeholder="Verification token"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleConfirmEmailVerification}
            disabled={confirmEmailVerification.isPending}
            className="w-full rounded-2xl bg-emerald-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            Verify Email
          </button>
          {confirmEmailVerification.error ? (
            <p className="text-sm text-rose-300">
              {confirmEmailVerification.error.message}
            </p>
          ) : confirmEmailVerification.isSuccess ? (
            <p className="text-sm text-emerald-300">
              Email verified. You can continue with the current session.
            </p>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function Dashboard() {
  // scaffold:items-state:start
  const [name, setName] = useState("");
  // scaffold:items-state:end
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteToken, setInviteToken] = useState("");
  const [latestToken, setLatestToken] = useState<string | null>(null);
  const { data: health } = useHealth();
  const { data: session, isLoading: isSessionLoading } = useSession();
  // scaffold:items-hooks:start
  const { data: items = [], isLoading } = useItems(!!session);
  // scaffold:items-hooks:end
  const { data: organizations } = useOrganizations(!!session);
  const { data: invites } = useOrganizationInvites(!!session);
  // scaffold:items-hooks:start
  const createItem = useCreateItem();
  // scaffold:items-hooks:end
  const createOrganization = useCreateOrganization();
  const switchOrganization = useSwitchOrganization();
  const createInvite = useCreateOrganizationInvite();
  const acceptInvite = useAcceptOrganizationInvite();
  const requestEmailVerification = useRequestEmailVerification();
  const logout = useLogout();

  // scaffold:items-hooks:start
  const handleAdd = () => {
    if (!name.trim()) return;
    createItem.mutate(name.trim());
    setName("");
  };
  // scaffold:items-hooks:end

  const handleCreateOrganization = () => {
    if (!orgName.trim()) return;
    createOrganization.mutate(orgName.trim(), {
      onSuccess: () => setOrgName(""),
    });
  };

  const handleCreateInvite = () => {
    if (!inviteEmail.trim()) return;
    createInvite.mutate(
      { email: inviteEmail.trim(), role: inviteRole },
      {
        onSuccess: (data) => {
          setInviteEmail("");
          setLatestToken(data.invite.token);
        },
      }
    );
  };

  const handleAcceptInvite = () => {
    if (!inviteToken.trim()) return;
    acceptInvite.mutate(inviteToken.trim(), {
      onSuccess: () => setInviteToken(""),
    });
  };

  const canManageInvites =
    session?.organizationRole === "owner" || session?.organizationRole === "admin";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_32%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)] px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.35em] text-amber-300/80">
                Starter Core
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-white">
                cf-starter
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">
                認証、organization context、invite lifecycle、Queue、D1 をまとめて確認するための最小管理画面です。
              </p>
            </div>
            {session ? (
              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100">
                <div className="font-medium">{session.name}</div>
                <div className="text-emerald-200/80">{session.email}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-200/70">
                  current org {session.currentOrganizationId}
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {health?.checks && (
          <div className="flex flex-wrap gap-3">
            {Object.entries(health.checks).map(([k, v]) => (
              <span
                key={k}
                className={`rounded-full px-3 py-1 text-sm font-mono ${
                  v === "ok"
                    ? "bg-emerald-400/15 text-emerald-200"
                    : "bg-rose-400/15 text-rose-200"
                }`}
              >
                {k}: {v}
              </span>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            {isSessionLoading ? (
              <Panel title="Session" subtitle="認証状態を確認しています。">
                <p className="text-sm text-slate-400">Loading...</p>
              </Panel>
            ) : session ? (
              <>
                <Panel
                  title="Organization Workspace"
                  subtitle="current organization の切替、作成、invite 管理をここで行います。"
                >
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div className="text-sm text-slate-300">Organizations</div>
                      <div className="space-y-2">
                        {organizations?.organizations?.map((organization) => (
                          <button
                            key={organization.organizationId}
                            type="button"
                            onClick={() =>
                              switchOrganization.mutate(organization.organizationId)
                            }
                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                              session.currentOrganizationId ===
                              organization.organizationId
                                ? "border-amber-300/40 bg-amber-300/10"
                                : "border-white/10 bg-slate-950/40"
                            }`}
                          >
                            <span>
                              <span className="block font-medium text-white">
                                {organization.organizationName}
                              </span>
                              <span className="block text-xs text-slate-400">
                                {organization.organizationSlug}
                              </span>
                            </span>
                            <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                              {organization.membershipRole}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                        <div className="mb-3 text-sm text-slate-300">
                          Create Organization
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="Regional Ops"
                            className="flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleCreateOrganization}
                            disabled={createOrganization.isPending}
                            className="rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                          >
                            Create
                          </button>
                        </div>
                        {createOrganization.error ? (
                          <p className="mt-2 text-sm text-rose-300">
                            {createOrganization.error.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                        <div className="mb-3 text-sm text-slate-300">Accept Invite</div>
                        <div className="flex gap-2">
                          <input
                            value={inviteToken}
                            onChange={(e) => setInviteToken(e.target.value)}
                            placeholder="Invite token"
                            className="flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleAcceptInvite}
                            disabled={acceptInvite.isPending}
                            className="rounded-2xl bg-fuchsia-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                          >
                            Accept
                          </button>
                        </div>
                        {acceptInvite.error ? (
                          <p className="mt-2 text-sm text-rose-300">
                            {acceptInvite.error.message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="Invites"
                  subtitle="owner / admin なら current organization 向けの招待を発行できます。"
                >
                  {canManageInvites ? (
                    <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                      <input
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) =>
                          setInviteRole(e.target.value as "admin" | "member")
                        }
                        className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                      >
                        <option value="member">member</option>
                        <option value="admin">admin</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleCreateInvite}
                        disabled={createInvite.isPending}
                        className="rounded-2xl bg-amber-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
                      >
                        Invite
                      </button>
                    </div>
                  ) : (
                    <p className="mb-4 text-sm text-slate-400">
                      current organization role が `owner` または `admin` のときだけ招待を作成できます。
                    </p>
                  )}
                  {latestToken ? (
                    <div className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-amber-200/80">
                        latest invite token
                      </div>
                      <div className="mt-2 break-all font-mono text-sm text-amber-100">
                        {latestToken}
                      </div>
                    </div>
                  ) : null}
                  {createInvite.error ? (
                    <p className="mb-4 text-sm text-rose-300">
                      {createInvite.error.message}
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    {invites?.invites?.length ? (
                      invites.invites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div>
                            <div className="font-medium text-white">{invite.email}</div>
                            <div className="text-xs text-slate-400">
                              role {invite.role} · expires {invite.expiresAt}
                            </div>
                          </div>
                          <div className="flex gap-2 text-xs uppercase tracking-[0.2em]">
                            <span className="rounded-full bg-white/5 px-3 py-1 text-slate-300">
                              {invite.status}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No invites yet.</p>
                    )}
                  </div>
                </Panel>
              </>
            ) : (
              <AuthPanel />
            )}
          </div>

          <div className="space-y-6">
            {session ? (
              <Panel title="Session" subtitle="現在の auth / organization context です。">
                <div className="space-y-2 text-sm text-slate-300">
                  <div>roles: {session.roles.join(", ")}</div>
                  <div>organizationRole: {session.organizationRole}</div>
                  <div>organizations: {session.organizations.length}</div>
                  <div>
                    emailVerified: {session.emailVerifiedAt ? session.emailVerifiedAt : "pending"}
                  </div>
                </div>
                {!session.emailVerifiedAt ? (
                  <button
                    type="button"
                    onClick={() => requestEmailVerification.mutate()}
                    disabled={requestEmailVerification.isPending}
                    className="mt-4 mr-3 rounded-2xl bg-emerald-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                  >
                    Resend Verification
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  className="mt-4 rounded-2xl bg-rose-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                >
                  Log Out
                </button>
              </Panel>
            ) : null}

            {/* scaffold:items-panel:start */}
            <Panel
              title="D1 Items"
              subtitle="Example feature は残して、core 追加後も RPC client と mutation が崩れていないことを見ます。"
            >
              <div className="mb-4 flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="New item..."
                  className="flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none"
                />
                <button
                  onClick={handleAdd}
                  disabled={createItem.isPending}
                  className="rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {isLoading ? (
                <p className="text-slate-500">Loading...</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
                    >
                      <span>{item.name}</span>
                      <span className="text-sm text-slate-500">{item.createdAt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            {/* scaffold:items-panel:end */}
          </div>
        </div>
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
