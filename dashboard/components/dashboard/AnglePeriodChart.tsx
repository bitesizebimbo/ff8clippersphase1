"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  anglePerformance,
  itemsInPeriods,
  type PeriodGranularity,
  type PeriodOption,
  type PeriodStats,
} from "@/lib/period-performance";
import { formatCompactNumber, formatExactNumber } from "@/lib/formatters";
import type { ContentItem } from "@/lib/types";

type Metric = "views" | "avgViews" | "engagements" | "posts";

/**
 * Grouped bars: one group per CXP angle, one bar per chosen week or month
 * in time order (oldest lightest, newest full accent), for one metric.
 */
export function AnglePeriodChart({
  content,
  granularity,
  periods,
  angles,
  metric,
  metricLabel,
}: {
  content: ContentItem[];
  granularity: PeriodGranularity;
  /** Oldest first. */
  periods: PeriodOption[];
  /** Angle names in the table's order. */
  angles: string[];
  metric: Metric;
  metricLabel: string;
}) {
  const data = useMemo(() => {
    const byPeriod = periods.map(
      (p) =>
        new Map<string, PeriodStats>(
          anglePerformance(itemsInPeriods(content, granularity, [p.key])).map((r) => [r.angle, r.stats]),
        ),
    );
    return angles.map((angle) => {
      const row: Record<string, string | number> = { angle };
      periods.forEach((p, i) => {
        row[p.key] = byPeriod[i].get(angle)?.[metric] ?? 0;
      });
      return row;
    });
  }, [content, granularity, periods, angles, metric]);

  if (periods.length === 0 || angles.length === 0) return null;

  // Older periods fade back so the latest stands out; never below 0.3.
  const opacity = (i: number) =>
    periods.length === 1 ? 1 : 0.3 + (0.7 * i) / (periods.length - 1);
  const label = (key: string) => periods.find((p) => p.key === key)?.label ?? key;

  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-foreground">{metricLabel} by CXP angle over time</h3>
      <p className="text-xs text-foreground-muted">
        Each angle shows one bar per {granularity === "weekly" ? "week" : "month"}, oldest to newest.
        Switch the metric with the tabs above the table.
      </p>
      <div className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          {/* Keyed on the periods: Recharts keeps bars in the order they were
              first mounted, so adding an older week would otherwise put it last. */}
          <BarChart
            key={periods.map((p) => p.key).join(",")}
            data={data}
            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            barGap={2}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="angle"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 12, fill: "var(--foreground-subtle)" }}
              tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tick={{ fontSize: 12, fill: "var(--foreground-subtle)" }}
              tickFormatter={(v: number) => formatCompactNumber(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-muted)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Record<string, string | number>;
                return (
                  <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-xs shadow-[var(--shadow-elevated)]">
                    <p className="mb-1.5 font-medium text-foreground">{row.angle}</p>
                    <dl className="space-y-1">
                      {periods.map((p) => (
                        <div key={p.key} className="flex items-center justify-between gap-6">
                          <dt className="text-foreground-muted">{p.label}</dt>
                          <dd className="font-medium tabular-nums text-foreground">
                            {formatExactNumber(Math.round(Number(row[p.key] ?? 0)))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              }}
            />
            {periods.map((p, i) => (
              <Bar
                key={p.key}
                dataKey={p.key}
                name={label(p.key)}
                fill="var(--accent)"
                fillOpacity={opacity(i)}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-foreground-muted">
        {periods.map((p, i) => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" style={{ opacity: opacity(i) }} aria-hidden />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
