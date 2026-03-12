export function toDisplayName(appName) {
  return appName
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

export function buildCoreOnlyAppTemplate(appName) {
  return CORE_ONLY_APP_TEMPLATE.replaceAll("__APP_DISPLAY_NAME__", toDisplayName(appName));
}

export function buildGenericHomePage(appName) {
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
