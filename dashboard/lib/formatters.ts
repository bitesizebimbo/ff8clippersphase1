// Centralized number/date formatting so every KPI, chart tooltip, and card
// renders the same value the same way.

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatExactNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(ratio: number, fractionDigits = 2): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(fractionDigits)}%`;
}

export function formatSignedPercent(pct: number, fractionDigits = 1): string {
  if (!Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(fractionDigits)}%`;
}

export function formatSignedPoints(pp: number, fractionDigits = 1): string {
  if (!Number.isFinite(pp)) return "—";
  const sign = pp > 0 ? "+" : "";
  return `${sign}${pp.toFixed(fractionDigits)} pp`;
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatOrDash(
  value: number | null | undefined,
  formatter: (v: number) => string = formatCompactNumber,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return formatter(value);
}
