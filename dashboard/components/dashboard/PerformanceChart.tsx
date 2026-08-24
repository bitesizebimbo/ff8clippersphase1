"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatCompactNumber,
  formatExactNumber,
  formatPercent,
} from "@/lib/formatters";
import { timelinePointValue } from "@/lib/analytics";
import type { ChartGranularity, ChartMetric, TimelinePoint } from "@/lib/types";
import { EmptyState } from "./EmptyState";

const METRIC_LABEL: Record<ChartMetric, string> = {
  views: "Views",
  engagements: "Engagements",
  engagementRate: "Engagement Rate",
};

const METRICS: ChartMetric[] = ["views", "engagements", "engagementRate"];

export function PerformanceChart({
  data,
  granularity,
  metric,
  onGranularityChange,
  onMetricChange,
}: {
  data: TimelinePoint[];
  granularity: ChartGranularity;
  metric: ChartMetric;
  onGranularityChange: (g: ChartGranularity) => void;
  onMetricChange: (m: ChartMetric) => void;
}) {
  const showRateOverlay = metric !== "engagementRate" && data.length > 1;

  const chartData = useMemo(
    () =>
      data.map((point) => ({
        ...point,
        primary: timelinePointValue(point, metric),
      })),
    [data, metric],
  );

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Performance Over Time
          </h2>
          <p className="text-sm text-foreground-muted">
            {METRIC_LABEL[metric]} by {granularity === "daily" ? "day" : "week"}
            {showRateOverlay ? " · engagement rate overlaid" : ""}
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

      <div className="mt-4 h-72">
        {chartData.length === 0 ? (
          <EmptyState
            title="No performance data in this range"
            description="Widen the date range to see the trend."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--foreground-subtle)" }}
                minTickGap={24}
              />
              <YAxis
                yAxisId="primary"
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fontSize: 12, fill: "var(--foreground-subtle)" }}
                tickFormatter={(v: number) =>
                  metric === "engagementRate" ? formatPercent(v, 1) : formatCompactNumber(v)
                }
              />
              {showRateOverlay && (
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fontSize: 12, fill: "var(--foreground-subtle)" }}
                  tickFormatter={(v: number) => formatPercent(v, 1)}
                />
              )}
              <Tooltip content={<ChartTooltip granularity={granularity} />} cursor={{ fill: "var(--surface-muted)" }} />
              <Bar
                yAxisId="primary"
                dataKey="primary"
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                maxBarSize={granularity === "weekly" ? 56 : 28}
              />
              {showRateOverlay && (
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="engagementRate"
                  stroke="var(--foreground-muted)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function ChartTooltip({
  active,
  payload,
  granularity,
}: {
  active?: boolean;
  payload?: Array<{ payload: TimelinePoint }>;
  granularity: ChartGranularity;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-xs shadow-[var(--shadow-elevated)]">
      <p className="mb-1.5 font-medium text-foreground">
        {granularity === "weekly" ? point.label : point.label}
      </p>
      <dl className="space-y-1">
        <Row label="Views" value={formatExactNumber(point.views)} />
        <Row label="Engagements" value={formatExactNumber(point.totalEngagements)} />
        <Row label="Engagement Rate" value={formatPercent(point.engagementRate)} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="tabular-nums font-medium text-foreground">{value}</dd>
    </div>
  );
}
