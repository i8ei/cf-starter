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

const queryClient = new QueryClient();

/**
 * Record Engine nav items — add entries here as you generate new records.
 * Each record page will be mounted at /:recordKey
 */
const recordNavItems: { label: string; href: string }[] = [
  // Example: { label: "配車依頼", href: "/request" },
];

/**
 * Public app nav items — used when AUTH_ENABLED=false with PublicShell.
 * Customise these for your public-facing app.
 */
const publicNavItems: { label: string; href: string }[] = [
  // Example: { label: "ダッシュボード", href: "/dashboard" },
];

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: health } = useHealth();
  const { data: session, isLoading } = useSession();

  // AUTH_ENABLED=false → use PublicShell (mobile-first single-column)
  if (health?.authEnabled === false) {
    return (
      <PublicShell navItems={publicNavItems}>
        {children}
      </PublicShell>
    );
  }

  // Auth enabled → use AppShell (desktop layout with sidebar nav)
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

function AppRoutes() {
  return (
    <Switch>
      {/*
        Public pages (no auth required) — mount at /p/* prefix:
        <Route path="/p/about" component={AboutPage} />
        Backend: register public API routes without requireAuth in src/index.ts
      */}

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
