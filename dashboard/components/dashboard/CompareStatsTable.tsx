import {
  formatCompactNumber,
  formatExactNumber,
  formatPercent,
  formatSignedPercent,
  formatSignedPoints,
} from "@/lib/formatters";
import type { CampaignCompareEntry } from "@/lib/compare";
import type { CampaignComparisonRow } from "@/lib/types";
import { COMPARE_SERIES_COLORS } from "./CompareTrendChart";

export function CompareStatsTable({
  entries,
  rows,
}: {
  entries: CampaignCompareEntry[];
  rows: CampaignComparisonRow[];
}) {
  const showDelta = entries.length === 2;

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:p-5">
      <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Key Stats</h2>
      <p className="text-sm text-foreground-muted">
        Each campaign&apos;s full run, side by side.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-foreground-subtle">
              <th className="py-2 pr-4 font-medium">Metric</th>
              {entries.map((entry, i) => (
                <th key={entry.meta.id} className="py-2 pr-4 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: COMPARE_SERIES_COLORS[i] }}
                      aria-hidden
                    />
                    {entry.meta.name}
                  </span>
                </th>
              ))}
              {showDelta && <th className="py-2 text-right font-medium">Difference</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metricKey} className="border-b border-border last:border-0">
                <td className="py-2.5 pr-4 text-foreground-muted">{row.label}</td>
                {row.values.map((v, i) => (
                  <td
                    key={entries[i].meta.id}
                    className="py-2.5 pr-4 text-right tabular-nums font-semibold text-foreground"
                    title={row.format === "percent" ? undefined : formatExactNumber(v)}
                  >
                    {row.format === "percent" ? formatPercent(v) : formatCompactNumber(v)}
                  </td>
                ))}
                {showDelta && (
                  <td className="py-2.5 text-right tabular-nums font-medium">
                    <DeltaBadge value={row.deltaPct} isPoints={row.format === "percent"} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeltaBadge({ value, isPoints }: { value: number | null; isPoints: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-foreground-subtle">—</span>;
  const tone = value > 0.5 ? "text-positive" : value < -0.5 ? "text-negative" : "text-foreground-muted";
  return (
    <span className={tone}>{isPoints ? formatSignedPoints(value) : formatSignedPercent(value)}</span>
  );
}
