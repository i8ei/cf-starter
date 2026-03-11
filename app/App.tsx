import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { useSession } from "./hooks/useSession";
import { AppShell } from "./components/AppShell";
import { AuthPage } from "./pages/AuthPage";
import { SettingsPage } from "./pages/SettingsPage";
// scaffold:items-import:start
import {
  useItems,
  useCreateItem,
} from "./features/example/items/hooks/useItems";
// scaffold:items-import:end
import { Panel } from "./components/Panel";

const queryClient = new QueryClient();

/**
 * Record Engine nav items — add entries here as you generate new records.
 * Each record page will be mounted at /:recordKey
 */
const recordNavItems: { label: string; href: string }[] = [
  // Example: { label: "配車依頼", href: "/request" },
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

// scaffold:items-panel:start
function ExampleItemsPage() {
  const [name, setName] = useState("");
  const { data: session } = useSession();
  const { data: items = [], isLoading } = useItems(!!session);
  const createItem = useCreateItem();

  const handleAdd = () => {
    if (!name.trim()) return;
    createItem.mutate(name.trim());
    setName("");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Panel
        title="D1 Items"
        subtitle="Example feature — verifies RPC client and mutations work."
      >
        <div className="mb-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="New item..."
            className="flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          />
          <button
            onClick={handleAdd}
            disabled={createItem.isPending}
            className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {isLoading ? (
          <p className="text-slate-400">Loading...</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3"
              >
                <span>{item.name}</span>
                <span className="text-sm text-slate-400">{item.createdAt}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
// scaffold:items-panel:end

function AppRoutes() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/settings" component={SettingsPage} />
        {/* Example feature route — kept for backward compatibility */}
        <Route path="/" component={ExampleItemsPage} />
        {/*
          Record Engine routes will be added here by the generator:
          <Route path="/:record" component={...} />
          <Route path="/:record/new" component={...} />
          <Route path="/:record/:id" component={...} />
          <Route path="/:record/:id/edit" component={...} />
        */}
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
