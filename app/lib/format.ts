export function fmtNumber(n: number): string {
  return isFinite(n) ? n.toLocaleString("ja-JP") : "–";
}

export function fmtCurrency(yen: number): string {
  return isFinite(yen) ? `¥${yen.toLocaleString("ja-JP")}` : "–";
}

export function fmtDiff(val: number): string {
  if (!isFinite(val)) return "–";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toLocaleString("ja-JP")}`;
}

export function fmtPercent(ratio: number): string {
  return isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : "–";
}
