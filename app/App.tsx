import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { useSession, useSetActiveOrganization, useListOrganizations, type SessionData } from "./hooks/useSession";
import { useHealth } from "./hooks/useHealth";
import { AppShell } from "./components/AppShell";
import { PublicShell } from "./components/PublicShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthPage } from "./pages/AuthPage";
import { InvitePage } from "./pages/InvitePage";
import { SettingsPage } from "./pages/SettingsPage";
import { HomePage } from "./pages/HomePage";
import { lazy, Suspense, useEffect, useRef } from "react";

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
 * Authenticated shell — only runs useSession when auth is enabled.
 * Prevents unnecessary /api/auth/me calls for public apps.
 */
/**
 * Auto-activates the first organization after login in better-auth mode.
 * Separated into its own component so org-related hooks are only called
 * when Better Auth endpoints are available (avoids 404 in simple-admin mode).
 */
function OrgAutoActivator({ session }: { session: SessionData }) {
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

  return null;
}

function AuthShell({ authMode, children }: { authMode: "simple-admin" | "better-auth"; children: React.ReactNode }) {
  const { data: session, isLoading } = useSession();

  const waitingForOrg = authMode === "better-auth" && session && !session.currentOrganizationId;

  if (isLoading || waitingForOrg) {
    return (
      <AppShell>
        {/* Render OrgAutoActivator only in better-auth mode while waiting for org */}
        {waitingForOrg && <OrgAutoActivator session={session} />}
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
