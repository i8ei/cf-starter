import { useState } from "react";

interface ChartTableToggleProps {
  chart: React.ReactNode;
  table: React.ReactNode;
  defaultView?: "chart" | "table";
}

export function ChartTableToggle({
  chart,
  table,
  defaultView = "chart",
}: ChartTableToggleProps) {
  const [view, setView] = useState<"chart" | "table">(defaultView);

  return (
    <div>
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setView("chart")}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
            view === "chart"
              ? "bg-blue-600 text-white"
              : "bg-surface-alt text-muted hover:bg-surface-hover"
          }`}
        >
          グラフ
        </button>
        <button
          onClick={() => setView("table")}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
            view === "table"
              ? "bg-blue-600 text-white"
              : "bg-surface-alt text-muted hover:bg-surface-hover"
          }`}
        >
          テーブル
        </button>
      </div>
      {view === "chart" ? chart : table}
    </div>
  );
}
