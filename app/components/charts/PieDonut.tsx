import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface PieDonutProps {
  data: { name: string; value: number; color?: string }[];
  colors?: string[];
  valueFormatter?: (v: number) => string;
  height?: number;
  /** Set > 0 for donut style */
  innerRadius?: number;
  outerRadius?: number;
  showLabel?: boolean;
  showLegend?: boolean;
}

const DEFAULT_COLORS = [
  "#2563eb", "#f97316", "#22c55e", "#a855f7", "#06b6d4",
  "#f43f5e", "#eab308", "#ec4899", "#14b8a6", "#6366f1",
];

export function PieDonut({
  data,
  colors = DEFAULT_COLORS,
  valueFormatter = (v) => (isFinite(v) ? v.toLocaleString() : "–"),
  height = 300,
  innerRadius = 0,
  outerRadius = 110,
  showLabel = true,
  showLegend = true,
}: PieDonutProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          dataKey="value"
          label={
            showLabel
              ? ({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(1)}%`
              : false
          }
          labelLine={showLabel ? { stroke: "#94a3b8" } : false}
          fontSize={10}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [valueFormatter(Number(value)), "金額"]}
          contentStyle={{ fontSize: 12 }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
      </PieChart>
    </ResponsiveContainer>
  );
}
