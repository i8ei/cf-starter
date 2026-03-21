import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { fmtNumber } from "~/lib/format";

interface StackedBarProps {
  data: Record<string, unknown>[];
  bars: { dataKey: string; name: string; color: string }[];
  xKey?: string;
  valueFormatter?: (v: number) => string;
  yTickFormatter?: (v: number) => string;
  height?: number;
  layout?: "horizontal" | "vertical";
  categoryWidth?: number;
  showGrid?: boolean;
  margin?: { left?: number; right?: number; top?: number; bottom?: number };
}

export function StackedBar({
  data,
  bars,
  xKey = "name",
  valueFormatter = fmtNumber,
  yTickFormatter,
  height = 300,
  layout = "horizontal",
  categoryWidth = 120,
  showGrid = false,
  margin,
}: StackedBarProps) {
  const h = layout === "vertical" ? Math.max(height, data.length * 36) : height;

  if (layout === "vertical") {
    const m = margin ?? { left: 0, right: 20, top: 4, bottom: 4 };
    return (
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={data} layout="vertical" margin={m}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey={xKey}
            width={categoryWidth}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value, name) => [valueFormatter(Number(value)), String(name)]}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {bars.map((b) => (
            <Bar key={b.dataKey} dataKey={b.dataKey} name={b.name} fill={b.color} stackId="a" />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const m = margin ?? { left: 0, right: 20, top: 4, bottom: 4 };
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={m}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis
          tickFormatter={yTickFormatter}
          tick={{ fontSize: 11 }}
          width={50}
        />
        <Tooltip
          formatter={(value, name) => [valueFormatter(Number(value)), String(name)]}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {bars.map((b) => (
          <Bar key={b.dataKey} dataKey={b.dataKey} name={b.name} fill={b.color} stackId="a" />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
