// Core domain types for the Content Performance Dashboard.
//
// `RawContentRecord` mirrors the ingested dataset (data/content.json) as-is.
// `ContentItem` is the derived, UI-facing shape: totalEngagements and
// engagementRate are always computed from the raw counters (see
// lib/analytics.ts) rather than trusted from source data, so the UI can
// never show numbers that disagree with each other.

export type Platform = "TikTok" | "YouTube" | (string & {});

export interface RawContentRecord {
  id: string;
  title: string;
  caption: string;
  creator: string;
  platform: Platform;
  contentUrl: string;
  publishDate: string; // ISO date (YYYY-MM-DD)
  product: string;
  approach: string;
  contentType: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
  thumbnailSeed: string;
}

export interface ContentItem extends RawContentRecord {
  totalEngagements: number;
  engagementRate: number; // 0..1, format with formatPercent for display
}

/**
 * One performance observation for a piece of content on a given date.
 *
 * The source dataset captures a single cumulative snapshot per post (taken
 * at the end of Phase 1) rather than true day-by-day observations, so each
 * ContentItem currently produces exactly one DailyPerformanceRecord dated at
 * its publishDate. The shape still supports genuine multi-day observation
 * data — when a live API provides daily snapshots per contentId, the data
 * layer's timeline functions require no changes.
 */
export interface DailyPerformanceRecord {
  date: string; // ISO date (YYYY-MM-DD), the metric OBSERVATION date
  contentId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
}

export type ClassificationDimension =
  | "product"
  | "approach"
  | "contentType"
  | "platform";

export interface ClassificationBreakdown {
  key: string;
  views: number;
  totalEngagements: number;
  engagementRate: number;
  contentCount: number;
}

export type ChartGranularity = "daily" | "weekly";
export type ChartMetric = "views" | "engagements" | "engagementRate";

export interface TimelinePoint {
  /** ISO date for daily granularity, or the ISO date of the week's Monday for weekly. */
  bucketStart: string;
  /** Human label, e.g. "16 Aug" or "Week 33". */
  label: string;
  views: number;
  totalEngagements: number;
  engagementRate: number;
}

export type SortOption =
  | "views-desc"
  | "engagements-desc"
  | "engagementRate-desc"
  | "date-desc"
  | "date-asc";

export type ViewMode = "grid" | "table";

export type DatePreset =
  | "last7"
  | "last30"
  | "last90"
  | "thisMonth"
  | "lastMonth"
  | "all"
  | "custom";

export interface DateRange {
  preset: DatePreset;
  start: string; // ISO date, inclusive
  end: string; // ISO date, inclusive
}

export interface DashboardFilters {
  dateRange: DateRange;
  product: string[];
  approach: string[];
  contentType: string[];
  platform: string[];
  search: string;
}

export interface DashboardSummary {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalEngagements: number;
  engagementRate: number;
  contentCount: number;
  /** Present only when a full previous-equivalent period exists within the dataset's date bounds. */
  comparison: DashboardComparison | null;
}

export interface DashboardComparison {
  totalViews: number;
  totalEngagements: number;
  engagementRate: number;
  deltaViewsPct: number;
  deltaEngagementsPct: number;
  deltaEngagementRatePp: number; // percentage-point delta
}
