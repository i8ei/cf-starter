import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getChartColors } from "./colors";
import { fmtNumber } from "~/lib/format";

interface PieDonutProps {
  data: { name: string; value: number; color?: string }[];
  colors?: string[];
  valueFormatter?: (v: number) => string;
  tooltipLabel?: string;
  height?: number;
  /** Set > 0 for donut style */
  innerRadius?: number;
  outerRadius?: number;
  showLabel?: boolean;
  showLegend?: boolean;
}

export function PieDonut({
  data,
  colors,
  valueFormatter = fmtNumber,
  tooltipLabel = "値",
  height = 300,
  innerRadius = 0,
  outerRadius = 110,
  showLabel = true,
  showLegend = true,
}: PieDonutProps) {
  const palette = colors ?? getChartColors(data.length);

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
            <Cell key={i} fill={d.color ?? palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [valueFormatter(Number(value)), tooltipLabel]}
          contentStyle={{ fontSize: 12 }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
      </PieChart>
    </ResponsiveContainer>
  );
}
