// Data-access abstraction. Every screen reads through these functions, never
// through a campaign's JSON file directly — so a local file can later be
// swapped for a live Google Sheet, REST API, Supabase, BigQuery, etc.
// without touching a single component. See README.md "Replacing mock data".
//
// Adding a campaign: register it in lib/campaigns.ts, add its raw records to
// CAMPAIGN_DATA below (each stamped with that campaign's id), and every
// function here — plus the switcher, All mode, and Compare mode — picks it
// up automatically.

import ff8Phase1Raw from "@/data/campaigns/ff8-clippers-phase1.json";
import {
  aggregateByClassification,
  buildSummary,
  buildTimeline,
  toContentItem,
  toDailyRecords,
} from "./analytics";
import { CAMPAIGNS } from "./campaigns";
import {
  filterContent,
  filterPerformanceByDate,
  getDatasetBounds,
  resolveDatePreset,
  resolvePreviousPeriod,
  type DatasetBounds,
} from "./filters";
import type {
  ChartGranularity,
  ClassificationBreakdown,
  ClassificationDimension,
  ContentItem,
  DashboardFilters,
  DashboardSummary,
  DatePreset,
  DateRange,
  RawContentRecord,
  SortOption,
  TimelinePoint,
} from "./types";

const CAMPAIGN_DATA: Record<string, RawContentRecord[]> = {
  "ff8-clippers-phase1": ff8Phase1Raw as RawContentRecord[],
};

const ALL_CONTENT: ContentItem[] = CAMPAIGNS.flatMap((c) =>
  (CAMPAIGN_DATA[c.id] ?? []).map(toContentItem),
);

const CONTENT_BY_ID = new Map(ALL_CONTENT.map((item) => [item.id, item]));
const GLOBAL_BOUNDS = getDatasetBounds(ALL_CONTENT);

function scopeToContent(campaignIds?: string[]): ContentItem[] {
  if (!campaignIds || campaignIds.length === 0) return ALL_CONTENT;
  return ALL_CONTENT.filter((item) => campaignIds.includes(item.campaignId));
}

/** Global bounds when no campaign is given (used by All mode); a single campaign's own bounds otherwise (used by Single mode). */
export function getDateBounds(campaignIds?: string[]): DatasetBounds {
  if (!campaignIds || campaignIds.length === 0) return GLOBAL_BOUNDS;
  return getDatasetBounds(scopeToContent(campaignIds));
}

export function resolveDateRange(
  preset: DatePreset,
  custom: { start: string; end: string } | undefined,
  bounds: DatasetBounds,
): DateRange {
  return resolveDatePreset(preset, bounds, custom);
}

export interface FilterOptions {
  product: string[];
  approach: string[];
  contentType: string[];
  platform: string[];
}

export function getFilterOptions(campaignIds?: string[]): FilterOptions {
  const scoped = scopeToContent(campaignIds);
  return {
    product: uniqueSorted(scoped.map((c) => c.product)),
    approach: uniqueSorted(scoped.map((c) => c.approach)),
    contentType: uniqueSorted(scoped.map((c) => c.contentType)),
    platform: uniqueSorted(scoped.map((c) => c.platform)),
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function getContentPerformance(filters: DashboardFilters): ContentItem[] {
  return filterContent(ALL_CONTENT, filters);
}

export function sortContent(
  items: ContentItem[],
  sortBy: SortOption,
): ContentItem[] {
  const sorted = [...items];
  switch (sortBy) {
    case "views-desc":
      return sorted.sort((a, b) => b.views - a.views);
    case "engagements-desc":
      return sorted.sort((a, b) => b.totalEngagements - a.totalEngagements);
    case "engagementRate-desc":
      return sorted.sort((a, b) => b.engagementRate - a.engagementRate);
    case "date-desc":
      return sorted.sort((a, b) => b.publishDate.localeCompare(a.publishDate));
    case "date-asc":
      return sorted.sort((a, b) => a.publishDate.localeCompare(b.publishDate));
    default:
      return sorted;
  }
}

export function getDashboardSummary(filters: DashboardFilters): DashboardSummary {
  const current = filterContent(ALL_CONTENT, filters);

  const bounds = getDateBounds(filters.campaign);
  const previousRange = resolvePreviousPeriod(filters.dateRange, bounds);
  const previous = previousRange
    ? filterContent(ALL_CONTENT, { ...filters, dateRange: previousRange })
    : null;

  return buildSummary(current, previous);
}

export function getPerformanceTimeline(
  filters: DashboardFilters,
  granularity: ChartGranularity,
): TimelinePoint[] {
  const matching = filterContent(ALL_CONTENT, filters);
  const matchingIds = new Set(matching.map((c) => c.id));
  const records = filterPerformanceByDate(
    toDailyRecords(ALL_CONTENT).filter((r) => matchingIds.has(r.contentId)),
    filters.dateRange,
  );
  return buildTimeline(records, granularity);
}

export function getClassificationPerformance(
  dimension: ClassificationDimension,
  filters: DashboardFilters,
): ClassificationBreakdown[] {
  const current = filterContent(ALL_CONTENT, filters);
  return aggregateByClassification(current, dimension);
}

export function getContentById(id: string): ContentItem | undefined {
  return CONTENT_BY_ID.get(id);
}

export function getTotalContentCount(campaignIds?: string[]): number {
  return scopeToContent(campaignIds).length;
}

export function getAllContent(): ContentItem[] {
  return ALL_CONTENT;
}
