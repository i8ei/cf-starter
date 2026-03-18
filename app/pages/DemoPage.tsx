import { KpiCard } from "~/components/KpiCard";
import { Section } from "~/components/Section";
import { ChartTableToggle } from "~/components/ChartTableToggle";
import { DataTableSimple } from "~/components/DataTableSimple";
import { HorizontalBar } from "~/components/charts/HorizontalBar";
import { PieDonut } from "~/components/charts/PieDonut";

const sampleData = [
  { name: "カテゴリ A", value: 420 },
  { name: "カテゴリ B", value: 310 },
  { name: "カテゴリ C", value: 180 },
  { name: "カテゴリ D", value: 90 },
];

/**
 * Dashboard kit demo page — exercises KpiCard, Section, ChartTableToggle,
 * DataTableSimple, HorizontalBar, and PieDonut in a single page.
 * Mount at /p/demo (outside AuthGuard) to verify the kit works.
 * Delete this file when you no longer need it.
 */
export function DemoPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-lg font-bold text-heading">Dashboard Kit Demo</h1>
      <p className="text-sm text-muted mt-1">
        KpiCard / Section / ChartTableToggle / DataTableSimple / Charts
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <KpiCard label="Total" value="1,000" sub="+12.3%" subColor="#22c55e" />
        <KpiCard label="Average" value="250" valueColor="#2563eb" />
      </div>

      <Section title="横棒グラフ / テーブル切替">
        <ChartTableToggle
          chart={<HorizontalBar data={sampleData} />}
          table={
            <DataTableSimple
              columns={[
                { key: "name", label: "カテゴリ" },
                { key: "value", label: "値", align: "right" },
              ]}
              data={sampleData}
              rowKey="name"
            />
          }
        />
      </Section>

      <Section title="ドーナツグラフ">
        <PieDonut data={sampleData} innerRadius={50} />
      </Section>
    </div>
  );
}
