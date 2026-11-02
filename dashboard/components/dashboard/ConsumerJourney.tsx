"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  JOURNEY_PRODUCTS,
  availableStages,
  buildJourneyTimeline,
  type JourneyGranularity,
  type JourneyPoint,
  type JourneyStage,
  type JourneyTargets,
} from "@/lib/consumer-journey";
import { formatCompactNumber, formatExactNumber, formatPercent } from "@/lib/formatters";
import type { ContentItem } from "@/lib/types";
import { EmptyState } from "./EmptyState";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ConsumerJourney({
  content,
  targets,
  defaultProductIds,
}: {
  content: ContentItem[];
  targets: JourneyTargets;
  /** Products picked when the section first shows; empty = all. */
  defaultProductIds: string[];
}) {
  const [productIds, setProductIds] = useState<string[]>(defaultProductIds);
  const [stage, setStage] = useState<JourneyStage | "all">("all");
  const [granularity, setGranularity] = useState<JourneyGranularity>("weekly");

  const selected = useMemo(
    () => (productIds.length ? productIds : JOURNEY_PRODUCTS.map((p) => p.id)),
    [productIds],
  );
  const labelOf = (id: string) => JOURNEY_PRODUCTS.find((p) => p.id === id)?.label ?? id;

  // Only stages that have planned or tagged posts get a tab.
  const stages = useMemo(() => availableStages(content, targets.rows, selected), [content, targets, selected]);
  const activeStage = stage !== "all" && !stages.includes(stage) ? "all" : stage;

  const points = useMemo(
    () => buildJourneyTimeline(content, targets.rows, selected, activeStage, granularity, todayIso()),
    [content, targets, selected, activeStage, granularity],
  );

  const totals = points.reduce(
    (t, p) => ({
      targetPosts: t.targetPosts + p.targetPosts,
      actualPosts: t.actualPosts + p.actualPosts,
      targetViews: t.targetViews + p.targetViews,
      actualViews: t.actualViews + p.actualViews,
    }),
    { targetPosts: 0, actualPosts: 0, targetViews: 0, actualViews: 0 },
  );
  const missingTargets = selected.filter((id) => targets.unavailable.includes(id));

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Flagship Consumer Journey
          </h2>
          <p className="text-sm text-foreground-muted">
            Daily breakdown target vs actual, from each product&apos;s start date to today. Not
            affected by the filters above.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <MultiSelect
            label="Product"
            options={JOURNEY_PRODUCTS.map((p) => p.label)}
            selected={productIds.map(labelOf)}
            onChange={(labels) =>
              setProductIds(JOURNEY_PRODUCTS.filter((p) => labels.includes(p.label)).map((p) => p.id))
            }
          />
          <Tabs value={granularity} onValueChange={(v) => setGranularity(v as JourneyGranularity)}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Tabs className="mt-4" value={activeStage} onValueChange={(v) => setStage(v as JourneyStage | "all")}>
        <TabsList>
          <TabsTrigger value="all">All stages</TabsTrigger>
          {stages.map((s) => (
            <TabsTrigger key={s} value={s}>
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {missingTargets.length > 0 && (
        <p className="mt-3 rounded-[var(--radius-sm)] bg-negative-soft px-3 py-2 text-xs text-negative">
          No targets for {missingTargets.map(labelOf).join(", ")}: its Master Daily Breakdown sheet
          isn&apos;t shared with the dashboard yet. Actuals are still shown.
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <JourneyChart
          title="Total Posts"
          points={points}
          target="targetPosts"
          actual="actualPosts"
          totalTarget={totals.targetPosts}
          totalActual={totals.actualPosts}
        />
        <JourneyChart
          title="Total Views"
          points={points}
          target="targetViews"
          actual="actualViews"
          totalTarget={totals.targetViews}
          totalActual={totals.actualViews}
        />
      </div>
    </section>
  );
}

function JourneyChart({
  title,
  points,
  target,
  actual,
  totalTarget,
  totalActual,
}: {
  title: string;
  points: JourneyPoint[];
  target: "targetPosts" | "targetViews";
  actual: "actualPosts" | "actualViews";
  totalTarget: number;
  totalActual: number;
}) {
  const empty = points.every((p) => p[target] === 0 && p[actual] === 0);
  return (
    <div className="rounded-[var(--radius-md)] border border-border p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-foreground-muted">
          <span className="font-semibold text-foreground">{formatCompactNumber(totalActual)}</span> actual
          {" / "}
          {formatCompactNumber(totalTarget)} target
          {totalTarget > 0 && (
            <span className="ml-1 font-semibold text-foreground">
              ({formatPercent(totalActual / totalTarget, 0)})
            </span>
          )}
        </p>
      </div>
      <div className="mt-3 h-64">
        {empty ? (
          <EmptyState
            title="Nothing for this stage yet"
            description="No planned or tagged posts for this stage and product."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--foreground-subtle)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fontSize: 12, fill: "var(--foreground-subtle)" }}
                tickFormatter={(v: number) => formatCompactNumber(v)}
              />
              <Tooltip
                content={<JourneyTooltip target={target} actual={actual} />}
                cursor={{ fill: "var(--surface-muted)" }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: "var(--foreground-muted)" }}
              />
              <Bar dataKey={target} name="Target" fill="var(--border-strong)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey={actual} name="Actual" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function JourneyTooltip({
  active,
  payload,
  target,
  actual,
}: {
  active?: boolean;
  payload?: Array<{ payload: JourneyPoint }>;
  target: "targetPosts" | "targetViews";
  actual: "actualPosts" | "actualViews";
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const t = point[target];
  const a = point[actual];
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-xs shadow-[var(--shadow-elevated)]">
      <p className="mb-1.5 font-medium text-foreground">{point.label}</p>
      <dl className="space-y-1">
        <Row label="Target" value={formatExactNumber(t)} />
        <Row label="Actual" value={formatExactNumber(a)} />
        <Row label="Achieved" value={t > 0 ? formatPercent(a / t, 0) : "–"} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
