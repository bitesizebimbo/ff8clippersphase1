// Compare-mode data assembly. Kept separate from data.ts because it has a
// fundamentally different scope: Single/All mode filter one merged pool of
// content by date range + classifications, while Compare summarizes two
// whole campaigns independently and lines them up side by side. Compare
// deliberately ignores the date-range/classification filter bar — two
// campaigns rarely share a calendar window or the same Product/Approach
// values, so "compare the full run of each" is the only comparison that's
// always well-defined.

import { buildSummary, indexTimelineFromStart, toDailyRecords } from "./analytics";
import { CAMPAIGNS, getCampaignMeta, type CampaignMeta } from "./campaigns";
import type {
  CampaignComparisonRow,
  ChartGranularity,
  ContentItem,
  DashboardSummary,
  TimelinePoint,
} from "./types";

export interface CampaignCompareEntry {
  meta: CampaignMeta;
  summary: DashboardSummary;
  timeline: TimelinePoint[];
}

/** Compare mode is capped at exactly two campaigns: a clean, unambiguous "A vs B" rather than an N-way table without a well-defined diff column. */
export const MAX_COMPARE_CAMPAIGNS = 2;

export function getComparableCampaigns(): CampaignMeta[] {
  return CAMPAIGNS;
}

export function buildCampaignCompareEntries(
  allContent: ContentItem[],
  campaignIds: string[],
  granularity: ChartGranularity,
): CampaignCompareEntry[] {
  return campaignIds.map((id) => {
    const meta = getCampaignMeta(id);
    if (!meta) throw new Error(`Unknown campaign id: ${id}`);
    const items = allContent.filter((c) => c.campaignId === id);
    const summary = buildSummary(items, null);
    const timeline = indexTimelineFromStart(toDailyRecords(items), granularity);
    return { meta, summary, timeline };
  });
}

interface MetricSpec {
  key: keyof DashboardSummary;
  label: string;
  format: "compact" | "percent";
}

const COMPARISON_METRICS: MetricSpec[] = [
  { key: "totalViews", label: "Total Views", format: "compact" },
  { key: "contentCount", label: "Total Content", format: "compact" },
  { key: "totalEngagements", label: "Total Engagements", format: "compact" },
  { key: "engagementRate", label: "Engagement Rate", format: "percent" },
  { key: "averageViewsPerContent", label: "Avg Views / Content", format: "compact" },
  { key: "totalLikes", label: "Likes", format: "compact" },
  { key: "totalComments", label: "Comments", format: "compact" },
  { key: "totalShares", label: "Shares", format: "compact" },
  { key: "totalSaves", label: "Saves", format: "compact" },
];

export function buildComparisonRows(
  entries: CampaignCompareEntry[],
): CampaignComparisonRow[] {
  return COMPARISON_METRICS.map((metric) => {
    const values = entries.map((e) => Number(e.summary[metric.key]));
    let deltaPct: number | null = null;
    if (values.length === 2) {
      // A rate's "difference" reads as percentage points (matches the KPI
      // period-over-period convention elsewhere); a count's reads as
      // relative % change — a % change of a % is a different, more
      // confusing number.
      deltaPct =
        metric.format === "percent"
          ? (values[1] - values[0]) * 100
          : percentDeltaSafe(values[1], values[0]);
    }
    return {
      metricKey: metric.key as string,
      label: metric.label,
      format: metric.format,
      values,
      deltaPct,
    };
  });
}

function percentDeltaSafe(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (!previous) return current > 0 ? Infinity : 0;
  return ((current - previous) / previous) * 100;
}
