// Pure calculation layer. Every KPI, chart, and card in the UI must derive
// its numbers from these functions so displayed values can never disagree
// with each other. Nothing here touches React or fetches data.

import type {
  ChartGranularity,
  ChartMetric,
  ClassificationBreakdown,
  ClassificationDimension,
  ClassificationMetric,
  ContentItem,
  DailyPerformanceRecord,
  DashboardComparison,
  DashboardSummary,
  RawContentRecord,
  TimelinePoint,
} from "./types";
import { formatShortDate } from "./formatters";

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

/**
 * Groups daily records into weeks and reduces each week to a TimelinePoint.
 *
 * A record's week is the sheet's own reporting week when it has one — teams
 * assign those by hand (e.g. a Monday counted with the previous week), and
 * the chart should add up the same way their own pivot does. Records
 * without one fall back to the ISO (Mon-Sun) week of their date.
 */
export function aggregateByWeek(
  records: DailyPerformanceRecord[],
): TimelinePoint[] {
  const buckets = new Map<string, { week: number; start: string; recs: DailyPerformanceRecord[] }>();
  for (const r of records) {
    const week = r.week ?? getIsoWeekNumber(r.date);
    const key = `${r.date.slice(0, 4)}-${String(week).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.recs.push(r);
      if (r.date < bucket.start) bucket.start = r.date;
    } else {
      buckets.set(key, { week, start: r.week ? r.date : startOfIsoWeek(r.date), recs: [r] });
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, { week, start, recs }]) => ({ ...bucketToPoint(start, `WK${week}`, recs), weekNumber: week }));
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

// Standard ISO 8601 week number: the week containing the year's first
// Thursday is week 1, counted from each week's own Thursday so it's
// unambiguous right at a year boundary.
function getIsoWeekNumber(iso: string): number {
  const target = new Date(`${iso}T00:00:00`);
  const dayNr = (target.getDay() + 6) % 7; // Mon=0..Sun=6
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
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
    week: item.week,
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
  const first = points[0];
  return points.map((p) => {
    if (granularity === "weekly" && first.weekNumber !== undefined && p.weekNumber !== undefined) {
      return { ...p, label: `Week ${p.weekNumber - first.weekNumber + 1}` };
    }
    const elapsedDays = daysBetweenIso(first.bucketStart, p.bucketStart);
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
  cxp: "cxp",
  commsFocus: "commsFocus",
  hookTheme: "hookTheme",
};

export function aggregateByClassification(
  items: ContentItem[],
  dimension: ClassificationDimension,
  metric: ClassificationMetric = "views",
): ClassificationBreakdown[] {
  const field = DIMENSION_KEY[dimension];
  const buckets = new Map<string, ContentItem[]>();
  for (const item of items) {
    const key = String(item[field] ?? "Unknown");
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }
  return [...buckets.entries()]
    .map(([key, list]) => {
      // For the "campaign" dimension, `key` is a campaignId — the caller
      // (ClassificationPerformance) resolves it to a display name using the
      // resolved campaign list, since that list isn't known here.
      const totals = sumEngagementInputs(list);
      const totalEngagements = calculateTotalEngagements(totals);
      return {
        key,
        views: totals.views,
        totalEngagements,
        engagementRate: calculateEngagementRate(totalEngagements, totals.views),
        contentCount: list.length,
        averageViewsPerContent: list.length > 0 ? Math.round(totals.views / list.length) : 0,
      };
    })
    .sort((a, b) =>
      metric === "avgViewsPerContent"
        ? b.averageViewsPerContent - a.averageViewsPerContent
        : b.views - a.views,
    );
}
