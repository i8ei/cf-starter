import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { useSession } from "./hooks/useSession";
import { useHealth } from "./hooks/useHealth";
import { AppShell } from "./components/AppShell";
import { PublicShell } from "./components/PublicShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthPage } from "./pages/AuthPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HomePage } from "./pages/HomePage";
import { lazy, Suspense } from "react";

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

  const authMode = (health?.authMode as string) ?? "better-auth";

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
