interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  valueColor?: string;
}

export function KpiCard({ label, value, sub, subColor, valueColor }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt p-4 text-center">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p
        className="text-2xl font-extrabold tabular-nums leading-tight"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={subColor ? { color: subColor } : undefined}>
          {sub}
        </p>
      )}
    </div>
  );
}
