// Data-access abstraction. Every screen reads through these functions, never
// through data/content.json directly — so the local JSON file can later be
// swapped for a REST API, Supabase, BigQuery, Google Sheets, etc. without
// touching a single component. See README.md "Replacing mock data".

import rawContent from "@/data/content.json";
import {
  aggregateByClassification,
  buildSummary,
  buildTimeline,
  toContentItem,
} from "./analytics";
import {
  filterContent,
  filterPerformanceByDate,
  getDatasetBounds,
  resolveDatePreset,
  resolvePreviousPeriod,
} from "./filters";
import type {
  ChartGranularity,
  ClassificationBreakdown,
  ClassificationDimension,
  ContentItem,
  DailyPerformanceRecord,
  DashboardFilters,
  DashboardSummary,
  DatePreset,
  DateRange,
  RawContentRecord,
  SortOption,
  TimelinePoint,
} from "./types";

const CONTENT: ContentItem[] = (rawContent as RawContentRecord[]).map(
  toContentItem,
);

// Each content item currently yields exactly one observation dated at its
// publishDate (see DailyPerformanceRecord doc comment in lib/types.ts).
const DAILY_RECORDS: DailyPerformanceRecord[] = CONTENT.map((item) => ({
  date: item.publishDate,
  contentId: item.id,
  views: item.views,
  likes: item.likes,
  comments: item.comments,
  shares: item.shares,
  saves: item.saves,
}));

const CONTENT_BY_ID = new Map(CONTENT.map((item) => [item.id, item]));
const DATASET_BOUNDS = getDatasetBounds(CONTENT);

export function getDatasetDateBounds() {
  return DATASET_BOUNDS;
}

export function resolveDateRange(
  preset: DatePreset,
  custom?: { start: string; end: string },
): DateRange {
  return resolveDatePreset(preset, DATASET_BOUNDS, custom);
}

export interface FilterOptions {
  product: string[];
  approach: string[];
  contentType: string[];
  platform: string[];
}

export function getFilterOptions(): FilterOptions {
  return {
    product: uniqueSorted(CONTENT.map((c) => c.product)),
    approach: uniqueSorted(CONTENT.map((c) => c.approach)),
    contentType: uniqueSorted(CONTENT.map((c) => c.contentType)),
    platform: uniqueSorted(CONTENT.map((c) => c.platform)),
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function getContentPerformance(filters: DashboardFilters): ContentItem[] {
  return filterContent(CONTENT, filters);
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
  const current = filterContent(CONTENT, filters);

  const previousRange = resolvePreviousPeriod(filters.dateRange, DATASET_BOUNDS);
  const previous = previousRange
    ? filterContent(CONTENT, { ...filters, dateRange: previousRange })
    : null;

  return buildSummary(current, previous);
}

export function getPerformanceTimeline(
  filters: DashboardFilters,
  granularity: ChartGranularity,
): TimelinePoint[] {
  const matchingIds = new Set(filterContent(CONTENT, filters).map((c) => c.id));
  const records = filterPerformanceByDate(
    DAILY_RECORDS.filter((r) => matchingIds.has(r.contentId)),
    filters.dateRange,
  );
  return buildTimeline(records, granularity);
}

export function getClassificationPerformance(
  dimension: ClassificationDimension,
  filters: DashboardFilters,
): ClassificationBreakdown[] {
  const current = filterContent(CONTENT, filters);
  return aggregateByClassification(current, dimension);
}

export function getContentById(id: string): ContentItem | undefined {
  return CONTENT_BY_ID.get(id);
}

export function getTotalContentCount(): number {
  return CONTENT.length;
}
