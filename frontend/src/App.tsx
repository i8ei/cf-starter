import { useEffect, useState } from 'react';

type Item = { id: number; name: string; created_at: string };

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [health, setHealth] = useState<Record<string, string> | null>(null);

  const fetchItems = async () => {
    const res = await fetch('/api/items');
    if (res.ok) setItems(await res.json());
  };

  const checkHealth = async () => {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      setHealth(data.checks);
    }
  };

  useEffect(() => {
    fetchItems();
    checkHealth();
  }, []);

  const addItem = async () => {
    if (!name.trim()) return;
    await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setName('');
    fetchItems();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">cf-starter</h1>

        {health && (
          <div className="flex gap-3">
            {Object.entries(health).map(([k, v]) => (
              <span
                key={k}
                className={`px-3 py-1 rounded text-sm font-mono ${
                  v === 'ok' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
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
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="New item..."
              className="flex-1 px-4 py-2 bg-gray-800 rounded border border-gray-700 focus:border-blue-500 outline-none"
            />
            <button
              onClick={addItem}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium"
            >
              Add
            </button>
          </div>
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-2 bg-gray-800 rounded flex justify-between">
                <span>{item.name}</span>
                <span className="text-gray-500 text-sm">{item.created_at}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
