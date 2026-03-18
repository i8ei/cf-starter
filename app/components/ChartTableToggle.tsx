import { useState, useId } from "react";

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
  const panelId = useId();

  return (
    <div>
      <div className="flex gap-1 mb-3" role="tablist" aria-label="表示切替">
        <button
          role="tab"
          aria-selected={view === "chart"}
          aria-controls={panelId}
          onClick={() => setView("chart")}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
            view === "chart"
              ? "bg-primary text-white"
              : "bg-surface-alt text-muted hover:bg-surface-hover"
          }`}
        >
          グラフ
        </button>
        <button
          role="tab"
          aria-selected={view === "table"}
          aria-controls={panelId}
          onClick={() => setView("table")}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
            view === "table"
              ? "bg-primary text-white"
              : "bg-surface-alt text-muted hover:bg-surface-hover"
          }`}
        >
          テーブル
        </button>
      </div>
      <div id={panelId} role="tabpanel">
        {view === "chart" ? chart : table}
      </div>
    </div>
  );
}
