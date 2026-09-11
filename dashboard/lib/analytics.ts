// Pure calculation layer. Every KPI, chart, and card in the UI must derive
// its numbers from these functions so displayed values can never disagree
// with each other. Nothing here touches React or fetches data.

import type {
  ChartGranularity,
  ChartMetric,
  ClassificationBreakdown,
  ClassificationDimension,
  ContentItem,
  DailyPerformanceRecord,
  DashboardComparison,
  DashboardSummary,
  RawContentRecord,
  TimelinePoint,
} from "./types";
import { formatShortDate } from "./formatters";
import { getCampaignMeta } from "./campaigns";

export function calculateTotalEngagements(record: {
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
}): number {
  return record.likes + record.comments + record.shares + (record.saves ?? 0);
}

export function calculateEngagementRate(
  totalEngagements: number,
  views: number,
): number {
  if (!views || views <= 0) return 0;
  return totalEngagements / views;
}

export function toContentItem(raw: RawContentRecord): ContentItem {
  const totalEngagements = calculateTotalEngagements(raw);
  return {
    ...raw,
    totalEngagements,
    engagementRate: calculateEngagementRate(totalEngagements, raw.views),
  };
}

export function sumEngagementInputs(
  records: Array<{
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves?: number;
  }>,
) {
  const initial = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
  return records.reduce<typeof initial>((acc, r) => {
    acc.views += r.views;
    acc.likes += r.likes;
    acc.comments += r.comments;
    acc.shares += r.shares;
    acc.saves += r.saves ?? 0;
    return acc;
  }, initial);
}

export function buildSummary(
  current: ContentItem[],
  previous: ContentItem[] | null,
): DashboardSummary {
  const totals = sumEngagementInputs(current);
  const totalEngagements = calculateTotalEngagements(totals);
  const engagementRate = calculateEngagementRate(totalEngagements, totals.views);

  let comparison: DashboardComparison | null = null;
  if (previous && previous.length > 0) {
    const prevTotals = sumEngagementInputs(previous);
    const prevEngagements = calculateTotalEngagements(prevTotals);
    const prevRate = calculateEngagementRate(prevEngagements, prevTotals.views);
    comparison = {
      totalViews: prevTotals.views,
      totalEngagements: prevEngagements,
      engagementRate: prevRate,
      deltaViewsPct: percentDelta(totals.views, prevTotals.views),
      deltaEngagementsPct: percentDelta(totalEngagements, prevEngagements),
      deltaEngagementRatePp: (engagementRate - prevRate) * 100,
    };
  }

  return {
    totalViews: totals.views,
    totalLikes: totals.likes,
    totalComments: totals.comments,
    totalShares: totals.shares,
    totalSaves: totals.saves,
    totalEngagements,
    engagementRate,
    contentCount: current.length,
    averageViewsPerContent:
      current.length > 0 ? Math.round(totals.views / current.length) : 0,
    comparison,
  };
}

function percentDelta(current: number, previous: number): number {
  if (!previous) return current > 0 ? Infinity : 0;
  return ((current - previous) / previous) * 100;
}

/** Groups daily records by ISO date and reduces each bucket to a TimelinePoint. */
export function aggregateByDate(
  records: DailyPerformanceRecord[],
): TimelinePoint[] {
  const buckets = new Map<string, DailyPerformanceRecord[]>();
  for (const r of records) {
    const list = buckets.get(r.date);
    if (list) list.push(r);
    else buckets.set(r.date, [r]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, recs]) => bucketToPoint(date, formatShortDate(date), recs));
}

/** Groups daily records into ISO (Mon-Sun) weeks and reduces each week to a TimelinePoint. */
export function aggregateByWeek(
  records: DailyPerformanceRecord[],
): TimelinePoint[] {
  const buckets = new Map<string, DailyPerformanceRecord[]>();
  for (const r of records) {
    const weekStart = startOfIsoWeek(r.date);
    const list = buckets.get(weekStart);
    if (list) list.push(r);
    else buckets.set(weekStart, [r]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, recs]) =>
      bucketToPoint(weekStart, `Week of ${formatShortDate(weekStart)}`, recs),
    );
}

function bucketToPoint(
  bucketStart: string,
  label: string,
  recs: DailyPerformanceRecord[],
): TimelinePoint {
  // Weekly ER is engagements-over-views for the whole bucket, never an
  // average of daily ERs (averaging rates would over-weight low-view days).
  const totals = sumEngagementInputs(recs);
  const totalEngagements = calculateTotalEngagements(totals);
  return {
    bucketStart,
    label,
    views: totals.views,
    totalEngagements,
    engagementRate: calculateEngagementRate(totalEngagements, totals.views),
  };
}

function startOfIsoWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function buildTimeline(
  records: DailyPerformanceRecord[],
  granularity: ChartGranularity,
): TimelinePoint[] {
  return granularity === "weekly"
    ? aggregateByWeek(records)
    : aggregateByDate(records);
}

export function timelinePointValue(
  point: TimelinePoint,
  metric: ChartMetric,
): number {
  switch (metric) {
    case "views":
      return point.views;
    case "engagements":
      return point.totalEngagements;
    case "engagementRate":
      return point.engagementRate;
  }
}

export function toDailyRecords(items: ContentItem[]): DailyPerformanceRecord[] {
  return items.map((item) => ({
    date: item.publishDate,
    contentId: item.id,
    views: item.views,
    likes: item.likes,
    comments: item.comments,
    shares: item.shares,
    saves: item.saves,
  }));
}

/**
 * Re-labels a timeline as "Day 1", "Day 2", ... (or "Week 1", "Week 2", ...)
 * relative to its own first bucket, instead of absolute calendar dates.
 *
 * Used only for Compare mode: two campaigns rarely run in the same calendar
 * window, so overlaying them by absolute date would misrepresent how far
 * into each campaign a given point sits. Indexing to "days/weeks since
 * start" is the same "index to a common base" move as normalizing two
 * differently-scaled series — it's what makes a single shared x-axis
 * meaningful across campaigns.
 */
export function indexTimelineFromStart(
  records: DailyPerformanceRecord[],
  granularity: ChartGranularity,
): TimelinePoint[] {
  const points = buildTimeline(records, granularity);
  if (points.length === 0) return points;
  const start = points[0].bucketStart;
  return points.map((p) => {
    const elapsedDays = daysBetweenIso(start, p.bucketStart);
    const label =
      granularity === "weekly" ? `Week ${Math.round(elapsedDays / 7) + 1}` : `Day ${elapsedDays + 1}`;
    return { ...p, label };
  });
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00`).getTime();
  const end = new Date(`${endIso}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

const DIMENSION_KEY: Record<ClassificationDimension, keyof ContentItem> = {
  product: "product",
  approach: "approach",
  contentType: "contentType",
  platform: "platform",
  campaign: "campaignId",
};

export function aggregateByClassification(
  items: ContentItem[],
  dimension: ClassificationDimension,
): ClassificationBreakdown[] {
  const field = DIMENSION_KEY[dimension];
  const buckets = new Map<string, ContentItem[]>();
  for (const item of items) {
    const key = String(item[field] ?? "Unknown");
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  const labelFor =
    dimension === "campaign"
      ? (key: string) => getCampaignMeta(key)?.name ?? key
      : (key: string) => key;
  return [...buckets.entries()]
    .map(([rawKey, list]) => {
      const key = labelFor(rawKey);
      const totals = sumEngagementInputs(list);
      const totalEngagements = calculateTotalEngagements(totals);
      return {
        key,
        views: totals.views,
        totalEngagements,
        engagementRate: calculateEngagementRate(totalEngagements, totals.views),
        contentCount: list.length,
      };
    })
    .sort((a, b) => b.views - a.views);
}
