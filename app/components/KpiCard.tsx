interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "success" | "danger" | "warning" | "primary";
  subColor?: string;
  valueColor?: string;
}

const variantColors: Record<string, string> = {
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning)",
  primary: "var(--primary)",
};

export function KpiCard({ label, value, sub, variant, subColor, valueColor }: KpiCardProps) {
  const resolvedValueColor = valueColor ?? (variant ? variantColors[variant] : undefined);
  const resolvedSubColor = subColor ?? (variant ? variantColors[variant] : undefined);

  return (
    <div className="rounded-xl border border-border bg-surface-alt p-4 text-center">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p
        className="text-2xl font-extrabold tabular-nums leading-tight"
        style={resolvedValueColor ? { color: resolvedValueColor } : undefined}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={resolvedSubColor ? { color: resolvedSubColor } : undefined}>
          {sub}
        </p>
      )}
    </div>
  );
}
