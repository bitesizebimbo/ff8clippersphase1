// Data-access layer. Every function here is a pure transform over a
// `content: ContentItem[]` array the caller provides — it holds no data of
// its own and doesn't know where that array came from (a static JSON file,
// a live Google Sheet, a future REST API — see lib/load-content.ts, which
// is the one place that actually assembles it). Components never touch a
// data source directly; they only call these functions.

import {
  aggregateByClassification,
  buildSummary,
  buildTimeline,
  toDailyRecords,
} from "./analytics";
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
  SortOption,
  TimelinePoint,
} from "./types";

function scopeToContent(content: ContentItem[], campaignIds?: string[]): ContentItem[] {
  if (!campaignIds || campaignIds.length === 0) return content;
  return content.filter((item) => campaignIds.includes(item.campaignId));
}

/** Global bounds when no campaign is given (used by All mode); a single campaign's own bounds otherwise (used by Single mode). */
export function getDateBounds(content: ContentItem[], campaignIds?: string[]): DatasetBounds {
  return getDatasetBounds(scopeToContent(content, campaignIds));
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

export function getFilterOptions(
  content: ContentItem[],
  campaignIds?: string[],
): FilterOptions {
  const scoped = scopeToContent(content, campaignIds);
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

export function getContentPerformance(
  content: ContentItem[],
  filters: DashboardFilters,
): ContentItem[] {
  return filterContent(content, filters);
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

export function getDashboardSummary(
  content: ContentItem[],
  filters: DashboardFilters,
): DashboardSummary {
  const current = filterContent(content, filters);

  const bounds = getDateBounds(content, filters.campaign);
  const previousRange = resolvePreviousPeriod(filters.dateRange, bounds);
  const previous = previousRange
    ? filterContent(content, { ...filters, dateRange: previousRange })
    : null;

  return buildSummary(current, previous);
}

export function getPerformanceTimeline(
  content: ContentItem[],
  filters: DashboardFilters,
  granularity: ChartGranularity,
): TimelinePoint[] {
  const matching = filterContent(content, filters);
  const matchingIds = new Set(matching.map((c) => c.id));
  const records = filterPerformanceByDate(
    toDailyRecords(content).filter((r) => matchingIds.has(r.contentId)),
    filters.dateRange,
  );
  return buildTimeline(records, granularity);
}

export function getClassificationPerformance(
  content: ContentItem[],
  dimension: ClassificationDimension,
  filters: DashboardFilters,
): ClassificationBreakdown[] {
  const current = filterContent(content, filters);
  return aggregateByClassification(current, dimension);
}

export function getTotalContentCount(
  content: ContentItem[],
  campaignIds?: string[],
): number {
  return scopeToContent(content, campaignIds).length;
}
