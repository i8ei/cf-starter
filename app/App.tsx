import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useItems, useCreateItem } from "./hooks/useItems";
import { useHealth } from "./hooks/useHealth";

const queryClient = new QueryClient();

function Dashboard() {
  const [name, setName] = useState("");
  const { data: items = [], isLoading } = useItems();
  const { data: health } = useHealth();
  const createItem = useCreateItem();

  const handleAdd = () => {
    if (!name.trim()) return;
    createItem.mutate(name.trim());
    setName("");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">cf-starter</h1>

        {health?.checks && (
          <div className="flex gap-3">
            {Object.entries(health.checks).map(([k, v]) => (
              <span
                key={k}
                className={`px-3 py-1 rounded text-sm font-mono ${
                  v === "ok"
                    ? "bg-green-900 text-green-300"
                    : "bg-red-900 text-red-300"
                }`}
              >
                {k}: {v}
              </span>
            ))}
          </div>
        )}

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">D1 Items</h2>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="New item..."
              className="flex-1 px-4 py-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 outline-none"
            />
            <button
              onClick={handleAdd}
              disabled={createItem.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded font-medium"
            >
              Add
            </button>
          </div>
          {isLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="px-4 py-2 bg-gray-800 rounded flex justify-between"
                >
                  <span>{item.name}</span>
                  <span className="text-gray-500 text-sm">
                    {item.createdAt}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
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
