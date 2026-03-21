import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getChartColors } from "./colors";
import { fmtNumber } from "~/lib/format";

interface HorizontalBarProps {
  data: { name: string; value: number }[];
  colors?: string[];
  valueFormatter?: (v: number) => string;
  tooltipLabel?: string;
  categoryWidth?: number;
  height?: number;
}

export function HorizontalBar({
  data,
  colors,
  valueFormatter = fmtNumber,
  tooltipLabel = "値",
  categoryWidth = 120,
  height,
}: HorizontalBarProps) {
  const palette = colors ?? getChartColors(data.length);
  const h = height ?? Math.max(250, data.length * 32);

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={categoryWidth}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value) => [valueFormatter(Number(value)), tooltipLabel]}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
