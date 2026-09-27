"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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
import type { CampaignMeta } from "@/lib/campaigns";
import type {
  ClassificationBreakdown,
  ClassificationDimension,
  ClassificationView,
} from "@/lib/types";
import { EmptyState } from "./EmptyState";

const BASE_DIMENSIONS: { id: ClassificationDimension; label: string }[] = [
  { id: "product", label: "Product" },
  { id: "approach", label: "Approach" },
  { id: "contentType", label: "Content Type" },
  { id: "platform", label: "Platform" },
];
const CAMPAIGN_DIMENSION = { id: "campaign" as ClassificationDimension, label: "Campaign" };

// Every row is one bar's height in the chart view — fixed rather than
// container-relative, since a dimension can have as few as 2 categories
// (Approach) or as many as a dozen (Content Type), and the chart should
// read the same either way rather than stretching thin bars across a
// fixed-height container.
const CHART_ROW_HEIGHT = 40;
const CHART_MIN_HEIGHT = 160;

export function ClassificationPerformance({
  dimension,
  breakdown,
  campaigns,
  showCampaignDimension,
  view,
  onDimensionChange,
  onViewChange,
}: {
  dimension: ClassificationDimension;
  breakdown: ClassificationBreakdown[];
  campaigns: CampaignMeta[];
  showCampaignDimension?: boolean;
  view: ClassificationView;
  onDimensionChange: (d: ClassificationDimension) => void;
  onViewChange: (v: ClassificationView) => void;
}) {
  const maxViews = Math.max(1, ...breakdown.map((b) => b.views));
  const dimensions = showCampaignDimension
    ? [...BASE_DIMENSIONS, CAMPAIGN_DIMENSION]
    : BASE_DIMENSIONS;
  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));
  const displayKey = (key: string) =>
    dimension === "campaign" ? (campaignNameById.get(key) ?? key) : key;

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Performance by Classification
          </h2>
          <p className="text-sm text-foreground-muted">
            Ranked by total views within the current filters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={dimension} onValueChange={(v) => onDimensionChange(v as ClassificationDimension)}>
            <TabsList>
              {dimensions.map((d) => (
                <TabsTrigger key={d.id} value={d.id}>
                  {d.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs value={view} onValueChange={(v) => onViewChange(v as ClassificationView)}>
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="chart">Bar Chart</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="mt-4">
        {breakdown.length === 0 ? (
          <EmptyState
            title="No content matches these filters"
            description="Try widening the date range or clearing a filter."
          />
        ) : view === "chart" ? (
          <BreakdownBarChart breakdown={breakdown} displayKey={displayKey} />
        ) : (
          <ul className="flex flex-col gap-3">
            {breakdown.map((row) => (
              <li key={row.key} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <span className="text-sm font-medium text-foreground">{displayKey(row.key)}</span>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs text-foreground-muted">
                    <span title={formatExactNumber(row.views)}>
                      <strong className="tabular-nums font-semibold text-foreground">
                        {formatCompactNumber(row.views)}
                      </strong>{" "}
                      views
                    </span>
                    <span title={formatExactNumber(row.totalEngagements)}>
                      <strong className="tabular-nums font-semibold text-foreground">
                        {formatCompactNumber(row.totalEngagements)}
                      </strong>{" "}
                      engagements
                    </span>
                    <span>
                      <strong className="tabular-nums font-semibold text-foreground">
                        {formatPercent(row.engagementRate)}
                      </strong>{" "}
                      ER
                    </span>
                    <span>
                      <strong className="tabular-nums font-semibold text-foreground">
                        {row.contentCount}
                      </strong>{" "}
                      posts
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(2, (row.views / maxViews) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BreakdownBarChart({
  breakdown,
  displayKey,
}: {
  breakdown: ClassificationBreakdown[];
  displayKey: (key: string) => string;
}) {
  const chartData = breakdown.map((row) => ({ ...row, label: displayKey(row.key) }));
  const height = Math.max(CHART_MIN_HEIGHT, chartData.length * CHART_ROW_HEIGHT);
  // Widen the label column for the longest category name so it never clips,
  // capped so one long outlier can't crush the bars down to nothing.
  const longestLabel = Math.max(...chartData.map((row) => row.label.length));
  const labelWidth = Math.min(180, Math.max(72, longestLabel * 7));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 0, bottom: 0 }}
          barCategoryGap={12}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--foreground-subtle)" }}
            tickFormatter={(v: number) => formatCompactNumber(v)}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={labelWidth}
            tick={{ fontSize: 12, fill: "var(--foreground-subtle)" }}
          />
          <Tooltip content={<BreakdownTooltip />} cursor={{ fill: "var(--surface-muted)" }} />
          <Bar dataKey="views" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={28}>
            <LabelList
              dataKey="views"
              position="right"
              formatter={(v: unknown) => formatCompactNumber(Number(v))}
              fill="var(--foreground-muted)"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BreakdownTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ClassificationBreakdown & { label: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-xs shadow-[var(--shadow-elevated)]">
      <p className="mb-1.5 font-medium text-foreground">{row.label}</p>
      <dl className="space-y-1">
        <Row label="Views" value={formatExactNumber(row.views)} />
        <Row label="Engagements" value={formatExactNumber(row.totalEngagements)} />
        <Row label="Engagement Rate" value={formatPercent(row.engagementRate)} />
        <Row label="Posts" value={String(row.contentCount)} />
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
