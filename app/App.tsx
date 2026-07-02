import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { useSession, useSetActiveOrganization, useListOrganizations, useCreateOrganization, type SessionData } from "./hooks/useSession";
import { useHealth } from "./hooks/useHealth";
import { AppShell } from "./components/AppShell";
import { PublicShell } from "./components/PublicShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Panel } from "./components/Panel";
import { AuthPage } from "./pages/AuthPage";
import { InvitePage } from "./pages/InvitePage";
import { SettingsPage } from "./pages/SettingsPage";
import { HomePage } from "./pages/HomePage";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

const DemoPage = lazy(() => import("./pages/DemoPage").then((m) => ({ default: m.DemoPage })));

const queryClient = new QueryClient();

/**
 * Record Engine nav items — add entries here as you generate new records.
 * Each record page will be mounted at /:recordKey
 */
const recordNavItems: { label: string; href: string }[] = [
  // Example: { label: "配車依頼", href: "/request" },
];

/**
 * Public app nav items — used when AUTH_MODE=none with PublicShell.
 * Customise these for your public-facing app.
 */
const publicNavItems: { label: string; href: string }[] = [
  // Example: { label: "ダッシュボード", href: "/dashboard" },
];

/**
 * Resolves the active organization in better-auth mode.
 * Separated into its own component so org-related hooks are only called
 * when Better Auth endpoints are available (avoids 404 in simple-admin mode).
 *
 * - Memberships exist → auto-activates the first organization.
 * - No memberships (self-signup without an invitation) → shows a
 *   create-organization form instead of waiting forever.
 */
function OrgGate({ session }: { session: SessionData }) {
  const orgs = useListOrganizations();
  const setActiveOrg = useSetActiveOrganization();
  const attempted = useRef(false);

  useEffect(() => {
    if (session.currentOrganizationId || attempted.current) return;
    const orgList = orgs.data;
    if (!orgList || orgList.length === 0) return;
    attempted.current = true;
    setActiveOrg.mutate(orgList[0].id);
  }, [session.currentOrganizationId, orgs.data, setActiveOrg]);

  if (orgs.data && orgs.data.length === 0) {
    return <CreateOrganizationPrompt />;
  }

  return (
    <div className="flex justify-center py-20">
      <p className="text-sm text-muted">Loading...</p>
    </div>
  );
}

function CreateOrganizationPrompt() {
  const [name, setName] = useState("");
  const createOrg = useCreateOrganization();
  const setActiveOrg = useSetActiveOrganization();

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || createOrg.isPending) return;
    createOrg.mutate(
      { name: trimmed },
      {
        onSuccess: (data) => {
          // Activate immediately — the session refetch it triggers is what
          // moves AuthShell past the org gate.
          if (data?.id) setActiveOrg.mutate(data.id);
        },
      }
    );
  };

  return (
    <div className="mx-auto max-w-sm">
      <Panel
        title="組織を作成"
        subtitle="所属している組織がありません。招待を受けている場合は、招待メールのリンクを開いてください。"
      >
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="組織名"
            className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createOrg.isPending || setActiveOrg.isPending}
            className="w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            作成
          </button>
          {createOrg.error ? (
            <p className="text-sm text-error-text">{createOrg.error.message}</p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function AuthShell({ authMode, children }: { authMode: "simple-admin" | "better-auth"; children: React.ReactNode }) {
  const { data: session, isLoading } = useSession();

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <p className="text-sm text-muted">Loading...</p>
        </div>
      </AppShell>
    );
  }
  if (!session) {
    return (
      <AppShell>
        <AuthPage authMode={authMode} />
      </AppShell>
    );
  }
  if (authMode === "better-auth" && !session.currentOrganizationId) {
    return (
      <AppShell>
        <OrgGate session={session} />
      </AppShell>
    );
  }
  return (
    <AppShell navItems={recordNavItems}>
      {children}
    </AppShell>
  );
}

/**
 * AuthGuard — waits for health check to determine auth mode before rendering.
 * Prevents flicker: public apps never show AppShell/AuthPage.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: health, isLoading: healthLoading } = useHealth();

  // Wait for health check to determine auth mode — show minimal loading
  if (healthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-sm text-muted">Loading...</p>
      </div>
    );
  }

  const authMode = health?.authMode ?? "better-auth";

  // AUTH_MODE=none → PublicShell (no session query)
  if (authMode === "none") {
    return (
      <PublicShell navItems={publicNavItems}>
        {children}
      </PublicShell>
    );
  }

  // simple-admin or better-auth → AuthShell (runs useSession)
  const shellMode = authMode === "simple-admin" ? "simple-admin" as const : "better-auth" as const;
  return <AuthShell authMode={shellMode}>{children}</AuthShell>;
}

function AppRoutes() {
  return (
    <Switch>
      {/* Public pages (no auth required) — outside AuthGuard */}
      <Route path="/p/demo">
        <Suspense fallback={<div className="flex justify-center py-20"><p className="text-sm text-muted">Loading...</p></div>}>
          <DemoPage />
        </Suspense>
      </Route>

      {/* Authenticated pages */}
      <Route>
        {() => (
          <AuthGuard>
            <Switch>
              {/* /invite is inside AuthGuard intentionally.
                  Better Auth's acceptInvitation requires an active session,
                  so the user must log in (or sign up) before accepting.
                  Flow: email link → AuthGuard → login if needed → InvitePage → accept */}
              <Route path="/invite" component={InvitePage} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/" component={HomePage} />
              {/* record-engine:routes */}
              <Route>
                <div className="mx-auto max-w-3xl py-20 text-center">
                  <h2 className="text-xl font-semibold text-heading">404</h2>
                  <p className="mt-2 text-sm text-muted">Page not found</p>
                </div>
              </Route>
            </Switch>
          </AuthGuard>
        )}
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
