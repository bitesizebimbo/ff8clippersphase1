"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCompactNumber, formatExactNumber, formatPercent } from "@/lib/formatters";
import { timelinePointValue } from "@/lib/analytics";
import type { CampaignCompareEntry } from "@/lib/compare";
import type { ChartGranularity, ChartMetric } from "@/lib/types";
import { EmptyState } from "./EmptyState";

// Validated 2-series categorical pair (indigo = the app's existing accent,
// orange = its CVD-safe partner) — see node scripts/validate_palette.js from
// the dataviz skill: worst adjacent CVD ΔE 31.4, normal-vision ΔE 39.2, both
// well clear of the 8 / 15 floors.
export const COMPARE_SERIES_COLORS = ["#4f46e5", "#eb6834"];

const METRIC_LABEL: Record<ChartMetric, string> = {
  views: "Views",
  engagements: "Engagements",
  engagementRate: "Engagement Rate",
};
const METRICS: ChartMetric[] = ["views", "engagements", "engagementRate"];

function parseElapsed(label: string): number {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function CompareTrendChart({
  entries,
  granularity,
  metric,
  onGranularityChange,
  onMetricChange,
}: {
  entries: CampaignCompareEntry[];
  granularity: ChartGranularity;
  metric: ChartMetric;
  onGranularityChange: (g: ChartGranularity) => void;
  onMetricChange: (m: ChartMetric) => void;
}) {
  const mergedData = useMemo(() => {
    const rows = new Map<number, Record<string, number | string>>();
    entries.forEach((entry, seriesIdx) => {
      entry.timeline.forEach((point) => {
        const elapsed = parseElapsed(point.label);
        const row = rows.get(elapsed) ?? { elapsed };
        row[`v${seriesIdx}`] = timelinePointValue(point, metric);
        row[`raw${seriesIdx}`] = JSON.stringify(point);
        rows.set(elapsed, row);
      });
    });
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
  }, [entries, metric]);

  const hasData = entries.some((e) => e.timeline.length > 0);
  const unit = granularity === "weekly" ? "Week" : "Day";

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Trend Comparison
          </h2>
          <p className="text-sm text-foreground-muted">
            {METRIC_LABEL[metric]} indexed to {unit.toLowerCase()}s since each campaign started.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={granularity} onValueChange={(v) => onGranularityChange(v as ChartGranularity)}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
            </TabsList>
          </Tabs>
          <select
            value={metric}
            onChange={(e) => onMetricChange(e.target.value as ChartMetric)}
            aria-label="Chart metric"
            className="h-9 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 text-sm text-foreground"
          >
            {METRICS.map((m) => (
              <option key={m} value={m}>
                {METRIC_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-4" aria-label="Legend">
        {entries.map((entry, i) => (
          <li key={entry.meta.id} className="flex items-center gap-1.5 text-sm text-foreground-muted">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: COMPARE_SERIES_COLORS[i] }}
              aria-hidden
            />
            {entry.meta.name}
          </li>
        ))}
      </ul>

      <div className="mt-3 h-72">
        {!hasData ? (
          <EmptyState
            title="No performance data yet"
            description="Neither campaign has data in range for this metric."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="elapsed"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--foreground-subtle)" }}
                tickFormatter={(v: number) => `${unit} ${v}`}
                minTickGap={32}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fontSize: 12, fill: "var(--foreground-subtle)" }}
                tickFormatter={(v: number) =>
                  metric === "engagementRate" ? formatPercent(v, 1) : formatCompactNumber(v)
                }
              />
              <Tooltip content={<CompareTooltip entries={entries} unit={unit} metric={metric} />} />
              {entries.map((entry, i) => (
                <Line
                  key={entry.meta.id}
                  type="monotone"
                  dataKey={`v${i}`}
                  name={entry.meta.name}
                  stroke={COMPARE_SERIES_COLORS[i]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function CompareTooltip({
  active,
  payload,
  label,
  entries,
  unit,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; payload: Record<string, string | number> }>;
  label?: number;
  entries: CampaignCompareEntry[];
  unit: string;
  metric: ChartMetric;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-xs shadow-[var(--shadow-elevated)]">
      <p className="mb-1.5 font-medium text-foreground">
        {unit} {label}
      </p>
      <dl className="space-y-1.5">
        {entries.map((entry, i) => {
          const raw = row[`raw${i}`];
          if (!raw) return null;
          const point = JSON.parse(String(raw));
          return (
            <div key={entry.meta.id}>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: COMPARE_SERIES_COLORS[i] }}
                  aria-hidden
                />
                {entry.meta.name}
              </div>
              <div className="ml-3.5 flex items-center justify-between gap-4 text-foreground-muted">
                <span>{METRIC_LABEL[metric]}</span>
                <span className="tabular-nums font-medium text-foreground">
                  {metric === "engagementRate"
                    ? formatPercent(point.engagementRate)
                    : formatExactNumber(timelinePointValue(point, metric))}
                </span>
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
