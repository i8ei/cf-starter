import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { fmtNumber } from "~/lib/format";

interface TrendLineProps {
  data: Record<string, unknown>[];
  lines: { dataKey: string; name: string; color: string }[];
  xKey?: string;
  valueFormatter?: (v: number) => string;
  yTickFormatter?: (v: number) => string;
  height?: number;
  showGrid?: boolean;
  margin?: { left?: number; right?: number; top?: number; bottom?: number };
}

export function TrendLine({
  data,
  lines,
  xKey = "year",
  valueFormatter = fmtNumber,
  yTickFormatter,
  height = 300,
  showGrid = true,
  margin = { left: 0, right: 20, top: 8, bottom: 4 },
}: TrendLineProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={margin}>
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
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {lines.map((l) => (
          <Line
            key={l.dataKey}
            type="monotone"
            dataKey={l.dataKey}
            name={l.name}
            stroke={l.color}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
