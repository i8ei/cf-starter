import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface HorizontalBarProps {
  data: { name: string; value: number }[];
  colors?: string[];
  valueFormatter?: (v: number) => string;
  height?: number;
}

const DEFAULT_COLORS = [
  "#2563eb", "#f97316", "#22c55e", "#a855f7", "#06b6d4",
  "#f43f5e", "#eab308", "#ec4899", "#14b8a6", "#6366f1",
];

export function HorizontalBar({
  data,
  colors = DEFAULT_COLORS,
  valueFormatter = (v) => (isFinite(v) ? v.toLocaleString() : "–"),
  height,
}: HorizontalBarProps) {
  const h = height ?? Math.max(250, data.length * 32);

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value) => [valueFormatter(Number(value)), "金額"]}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
