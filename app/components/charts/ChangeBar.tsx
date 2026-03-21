import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { fmtDiff } from "~/lib/format";

interface ChangeBarProps {
  data: { name: string; value: number }[];
  valueFormatter?: (v: number) => string;
  tooltipLabel?: string;
  positiveColor?: string;
  negativeColor?: string;
  categoryWidth?: number;
  height?: number;
}

export function ChangeBar({
  data,
  valueFormatter = fmtDiff,
  tooltipLabel = "増減",
  positiveColor = "#22c55e",
  negativeColor = "#f43f5e",
  categoryWidth = 120,
  height,
}: ChangeBarProps) {
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
        <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? positiveColor : negativeColor} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
