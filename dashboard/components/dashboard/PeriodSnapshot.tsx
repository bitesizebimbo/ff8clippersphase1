"use client";

import { useMemo, useState } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  anglePerformance,
  itemsInPeriods,
  periodOptions,
  periodStats,
  topBy,
  type PostMetric,
  type PeriodGranularity,
  type PeriodOption,
  type PeriodStats,
} from "@/lib/period-performance";
import {
  formatCompactNumber,
  formatPercent,
  formatShortDate,
  formatSignedPercent,
  formatSignedPoints,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/lib/types";
import { AnglePeriodChart } from "./AnglePeriodChart";
import { ContentCard } from "./ContentCard";
import { EmptyState } from "./EmptyState";

type AngleMetric = "views" | "avgViews" | "engagements" | "posts";

const ANGLE_METRICS: { id: AngleMetric; label: string }[] = [
  { id: "views", label: "Views" },
  { id: "posts", label: "No. of Posts" },
  { id: "avgViews", label: "Avg Views per Post" },
  { id: "engagements", label: "Total Engagements" },
];

const TOP_N = 7;

const POST_METRICS: { id: PostMetric; label: string }[] = [
  { id: "views", label: "Views" },
  { id: "totalEngagements", label: "Total Engagements" },
  { id: "engagementRate", label: "Engagement Rate" },
  { id: "likes", label: "Likes" },
  { id: "comments", label: "Comments" },
  { id: "shares", label: "Shares" },
  { id: "saves", label: "Saves" },
];

// Shared by the CXP angle header row and its rows so the columns line up.
const ANGLE_GRID = "grid-cols-2 gap-x-4 sm:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] sm:items-start";

/** The `count` periods right before the earliest chosen one (options are newest first). */
function previousPeriods(options: PeriodOption[], chosen: string[]): string[] {
  if (chosen.length === 0) return [];
  const oldest = Math.max(...chosen.map((k) => options.findIndex((o) => o.key === k)));
  return options.slice(oldest + 1, oldest + 1 + chosen.length).map((o) => o.key);
}

function describe(keys: string[], options: PeriodOption[]): string {
  if (keys.length === 0) return "All";
  return options
    .filter((o) => keys.includes(o.key))
    .map((o) => o.label)
    .reverse()
    .join(" + ");
}

export function PeriodSnapshot({
  content,
  onSelect,
}: {
  /** The campaign's posts after the filter bar, ignoring its Week and date range. */
  content: ContentItem[];
  onSelect: (id: string) => void;
}) {
  const [granularity, setGranularity] = useState<PeriodGranularity>("weekly");
  const options = useMemo(() => periodOptions(content, granularity), [content, granularity]);
  const [periodA, setPeriodA] = useState<string[] | null>(null);
  const [periodB, setPeriodB] = useState<string[] | null>(null);
  const [comparing, setComparing] = useState(false);
  const [metric, setMetric] = useState<AngleMetric>("views");
  // Best content follows the table's metric (posts and averages don't apply
  // to a single post, so those rank by views) until picked by hand.
  const [postMetricPicked, setPostMetricPicked] = useState<PostMetric | null>(null);
  const postMetric: PostMetric = postMetricPicked ?? (metric === "engagements" ? "totalEngagements" : "views");

  // Until picked, A is the latest period and B the one(s) right before A.
  const keysA = useMemo(
    () => (periodA ?? options.slice(0, 1).map((o) => o.key)).filter((k) => options.some((o) => o.key === k)),
    [periodA, options],
  );
  const keysB = useMemo(
    () => (periodB ?? previousPeriods(options, keysA)).filter((k) => options.some((o) => o.key === k)),
    [periodB, options, keysA],
  );

  const itemsA = useMemo(() => itemsInPeriods(content, granularity, keysA), [content, granularity, keysA]);
  const itemsB = useMemo(
    () => (comparing ? itemsInPeriods(content, granularity, keysB) : []),
    [comparing, content, granularity, keysB],
  );
  const statsA = periodStats(itemsA);
  const statsB = comparing ? periodStats(itemsB) : null;

  const angles = useMemo(() => {
    const a = anglePerformance(itemsA);
    const b = comparing ? new Map(anglePerformance(itemsB).map((r) => [r.angle, r.stats])) : new Map<string, PeriodStats>();
    const names = new Set([...a.map((r) => r.angle), ...b.keys()]);
    const empty = periodStats([]);
    return [...names]
      .map((angle) => ({
        angle,
        a: a.find((r) => r.angle === angle)?.stats ?? empty,
        b: b.get(angle) ?? null,
      }))
      .sort((x, y) => y.a[metric] - x.a[metric] || (y.b?.[metric] ?? 0) - (x.b?.[metric] ?? 0));
  }, [itemsA, itemsB, comparing, metric]);

  // The chart's bars: every chosen period (and, comparing, every compared
  // one), oldest first. No periods chosen means all of them.
  const chartPeriods = useMemo(() => {
    const keys = new Set(keysA.length ? keysA : options.map((o) => o.key));
    if (comparing) keysB.forEach((k) => keys.add(k));
    return options.filter((o) => keys.has(o.key)).reverse();
  }, [keysA, keysB, comparing, options]);

  const labelA = describe(keysA, options);
  const labelB = describe(keysB, options);
  const toKeys = (labels: string[]) => options.filter((o) => labels.includes(o.label)).map((o) => o.key);
  const toLabels = (keys: string[]) => options.filter((o) => keys.includes(o.key)).map((o) => o.label);

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Period Snapshot
          </h2>
          <p className="text-sm text-foreground-muted">
            Views, posts and CXP angles for the {granularity === "weekly" ? "weeks" : "months"} you pick.
            Follows the filters above except Week and date range.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground-subtle">View by</span>
            <select
              value={granularity}
              onChange={(e) => {
                setGranularity(e.target.value as PeriodGranularity);
                setPeriodA(null);
                setPeriodB(null);
              }}
              className="h-9 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 text-sm text-foreground"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <MultiSelect
            label={granularity === "weekly" ? "Weeks" : "Months"}
            options={options.map((o) => o.label)}
            selected={toLabels(keysA)}
            onChange={(labels) => setPeriodA(toKeys(labels))}
          />
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-border px-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={comparing}
              onChange={(e) => setComparing(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Compare
          </label>
          {comparing && (
            <MultiSelect
              label="Compare with"
              options={options.map((o) => o.label)}
              selected={toLabels(keysB)}
              onChange={(labels) => setPeriodB(toKeys(labels))}
            />
          )}
        </div>
      </div>

      {itemsA.length === 0 && !statsB?.posts ? (
        <div className="mt-4">
          <EmptyState title="No posts in these periods" description="Pick other weeks or months." />
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs text-foreground-muted">
            Showing <span className="font-semibold text-foreground">{labelA}</span>
            {statsA.posts > 0 && ` · ${formatShortDate(statsA.firstDate)} to ${formatShortDate(statsA.lastDate)}`} ·{" "}
            {statsA.posts} posts
            {statsB && (
              <>
                {" "}vs <span className="font-semibold text-foreground">{labelB}</span>
                {statsB.posts > 0 && ` · ${formatShortDate(statsB.firstDate)} to ${formatShortDate(statsB.lastDate)}`} ·{" "}
                {statsB.posts} posts
              </>
            )}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Views" value={statsA.views} compare={statsB?.views} />
            <Tile label="Posts" value={statsA.posts} compare={statsB?.posts} exact />
            <Tile label="Avg views per post" value={statsA.avgViews} compare={statsB?.avgViews} />
            <Tile
              label={`Top post views${statsA.top?.cxp ? ` (${statsA.top.cxp})` : ""}`}
              value={statsA.top?.views ?? 0}
              compare={statsB ? (statsB.top?.views ?? 0) : undefined}
            />
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Performance by CXP angle</h3>
              <p className="text-xs text-foreground-muted">
                {angles.length} angles, ranked by {ANGLE_METRICS.find((m) => m.id === metric)?.label.toLowerCase()}
                {statsB ? ` in ${labelA}` : ""}
              </p>
            </div>
            <Tabs value={metric} onValueChange={(v) => {
                setMetric(v as AngleMetric);
                setPostMetricPicked(null);
              }}>
              <TabsList>
                {ANGLE_METRICS.map((m) => (
                  <TabsTrigger key={m.id} value={m.id}>
                    {m.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className={cn(ANGLE_GRID, "mt-3 hidden border-b border-border pb-2 text-xs font-medium text-foreground-subtle sm:grid")}>
            <span>CXP angle</span>
            {ANGLE_METRICS.map((m) => (
              <span key={m.id} className="text-right">
                {m.label}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-border">
            {angles.map(({ angle, a, b }) => (
              <li key={angle} className={cn(ANGLE_GRID, "grid gap-y-2 py-3")}>
                <p className="col-span-2 text-sm font-semibold text-foreground sm:col-span-1">{angle}</p>
                <Cell label="Views" value={a.views} compare={b?.views} highlight={metric === "views"} comparing={!!statsB} />
                <Cell label="No. of Posts" value={a.posts} compare={b?.posts} exact highlight={metric === "posts"} comparing={!!statsB} />
                <Cell label="Avg Views per Post" value={a.avgViews} compare={b?.avgViews} highlight={metric === "avgViews"} comparing={!!statsB} />
                <Cell label="Total Engagements" value={a.engagements} compare={b?.engagements} highlight={metric === "engagements"} comparing={!!statsB} />
              </li>
            ))}
          </ul>

          <AnglePeriodChart
            content={content}
            granularity={granularity}
            periods={chartPeriods}
            angles={angles.map((r) => r.angle)}
            metric={metric}
            metricLabel={ANGLE_METRICS.find((m) => m.id === metric)?.label ?? ""}
          />

          <TopPosts
            title={`Best performing content · ${labelA}`}
            items={topBy(itemsA, postMetric, TOP_N)}
            metric={postMetric}
            onSelect={onSelect}
            control={
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground-subtle">Rank by</span>
                <select
                  value={postMetric}
                  onChange={(e) => setPostMetricPicked(e.target.value as PostMetric)}
                  className="h-9 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 text-sm text-foreground"
                >
                  {POST_METRICS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            }
          />
          {statsB && (
            <TopPosts
              title={`Best performing content · ${labelB}`}
              items={topBy(itemsB, postMetric, TOP_N)}
              metric={postMetric}
              onSelect={onSelect}
            />
          )}
        </>
      )}
    </section>
  );
}

function change(value: number, compare: number, rate?: boolean): { text: string; up: boolean | null } {
  if (rate) {
    const pp = (value - compare) * 100;
    return { text: formatSignedPoints(pp, 2), up: pp === 0 ? null : pp > 0 };
  }
  if (!compare) return { text: value ? "new" : "–", up: value ? true : null };
  const pct = ((value - compare) / compare) * 100;
  return { text: formatSignedPercent(pct), up: pct === 0 ? null : pct > 0 };
}

function Delta({ value, compare, rate }: { value: number; compare: number; rate?: boolean }) {
  const { text, up } = change(value, compare, rate);
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        up === true && "bg-positive-soft text-positive",
        up === false && "bg-negative-soft text-negative",
        up === null && "bg-surface-muted text-foreground-muted",
      )}
    >
      {text}
    </span>
  );
}

function fmt(value: number, { exact, rate }: { exact?: boolean; rate?: boolean }): string {
  if (rate) return formatPercent(value);
  return exact ? String(value) : formatCompactNumber(value);
}

function Tile({ label, value, compare, exact }: { label: string; value: number; compare?: number; exact?: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-surface-muted p-3 sm:p-4">
      <p className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{fmt(value, { exact })}</p>
      <p className="mt-0.5 text-xs text-foreground-muted">{label}</p>
      {compare !== undefined && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-foreground-muted">
          <Delta value={value} compare={compare} />
          vs {fmt(compare, { exact })}
        </p>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  compare,
  exact,
  rate,
  highlight,
  comparing,
}: {
  label: string;
  value: number;
  compare?: number;
  exact?: boolean;
  rate?: boolean;
  highlight?: boolean;
  comparing: boolean;
}) {
  return (
    <div className="sm:text-right">
      <p className={cn("text-sm font-semibold tabular-nums", highlight ? "text-accent" : "text-foreground")}>
        {fmt(value, { exact, rate })}
      </p>
      {/* Phones have no header row, so each number carries its own name. */}
      <p className="text-[11px] text-foreground-subtle sm:hidden">{label}</p>
      {comparing && (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-foreground-muted sm:justify-end">
          vs {fmt(compare ?? 0, { exact, rate })}
          <Delta value={value} compare={compare ?? 0} rate={rate} />
        </p>
      )}
    </div>
  );
}

function TopPosts({
  title,
  items,
  metric,
  onSelect,
  control,
}: {
  title: string;
  items: ContentItem[];
  metric: PostMetric;
  onSelect: (id: string) => void;
  control?: React.ReactNode;
}) {
  const metricLabel = POST_METRICS.find((m) => m.id === metric)?.label.toLowerCase();
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-foreground-muted">
            Top {TOP_N} posts by {metricLabel}
          </p>
        </div>
        {control}
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-foreground-muted">No posts in this period.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {items.map((item) => (
            <ContentCard key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
