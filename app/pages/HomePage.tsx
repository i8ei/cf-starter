import { useSession } from "../hooks/useSession";
import { useItems } from "../features/example/items/hooks/useItems";
import { Panel } from "../components/Panel";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HomePage() {
  const { data: session } = useSession();
  const { data: items = [], isLoading } = useItems(!!session);

  const recent = [...items]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-white">Welcome to cf-starter</h1>

      <div className="flex flex-wrap gap-3">
        <a
          href="/items"
          className="rounded-xl border border-white/10 bg-white/5 p-4 min-w-[140px] transition hover:bg-white/10"
        >
          <p className="text-sm text-slate-400">Items</p>
          <p className="text-2xl font-bold tabular-nums text-white">
            {isLoading ? "—" : items.length}
          </p>
        </a>
      </div>

      <Panel title="Recent updates">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : recent.length === 0 ? (
          <p className="text-sm text-slate-400">No items yet</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3"
              >
                <span className="text-sm text-white">{item.name}</span>
                <span className="text-xs text-slate-400">{timeAgo(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
