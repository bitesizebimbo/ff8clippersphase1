// Date-range resolution and record filtering. Kept separate from
// analytics.ts (which only aggregates) so "what subset of records is in
// play" stays in one obvious place.

import type {
  ContentItem,
  DailyPerformanceRecord,
  DashboardFilters,
  DatePreset,
  DateRange,
} from "./types";

export interface DatasetBounds {
  minDate: string;
  maxDate: string;
}

export function getDatasetBounds(items: ContentItem[]): DatasetBounds {
  let min = items[0]?.publishDate ?? "1970-01-01";
  let max = items[0]?.publishDate ?? "1970-01-01";
  for (const item of items) {
    if (item.publishDate < min) min = item.publishDate;
    if (item.publishDate > max) max = item.publishDate;
  }
  return { minDate: min, maxDate: max };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Resolves a preset into concrete start/end ISO dates.
 *
 * Presets are anchored to the dataset's most recent date rather than the
 * wall-clock "today": this is a bounded Phase 1 campaign report (6–13 Aug
 * 2026), so "Last 7 Days" means the last 7 days of reported activity, not a
 * window that has since rolled past the campaign entirely.
 */
export function resolveDatePreset(
  preset: DatePreset,
  bounds: DatasetBounds,
  custom?: { start: string; end: string },
): DateRange {
  const anchor = bounds.maxDate;
  switch (preset) {
    case "last7":
      return { preset, start: maxIso(addDays(anchor, -6), bounds.minDate), end: anchor };
    case "last30":
      return { preset, start: maxIso(addDays(anchor, -29), bounds.minDate), end: anchor };
    case "last90":
      return { preset, start: maxIso(addDays(anchor, -89), bounds.minDate), end: anchor };
    case "thisMonth":
      return { preset, start: maxIso(startOfMonth(anchor), bounds.minDate), end: anchor };
    case "lastMonth": {
      const prevMonthAnchor = addMonths(anchor, -1);
      const start = startOfMonth(prevMonthAnchor);
      const end = addDays(startOfMonth(anchor), -1);
      return {
        preset,
        start: maxIso(start, bounds.minDate),
        end: minIso(end, bounds.maxDate),
      };
    }
    case "custom":
      return {
        preset,
        start: custom?.start ?? bounds.minDate,
        end: custom?.end ?? bounds.maxDate,
      };
    case "all":
    default:
      return { preset: "all", start: bounds.minDate, end: bounds.maxDate };
  }
}

function maxIso(a: string, b: string): string {
  return a > b ? a : b;
}
function minIso(a: string, b: string): string {
  return a < b ? a : b;
}

/**
 * The previous equivalent period, clamped to the dataset's actual bounds.
 * Returns null when the range already touches the dataset's earliest date
 * (there is no real prior data to compare against — never fabricate one).
 */
export function resolvePreviousPeriod(
  range: DateRange,
  bounds: DatasetBounds,
): DateRange | null {
  if (range.start <= bounds.minDate) return null;
  const spanDays = daysBetween(range.start, range.end) + 1;
  const prevEnd = addDays(range.start, -1);
  const prevStart = addDays(prevEnd, -(spanDays - 1));
  if (prevStart < bounds.minDate) return null;
  return { preset: "custom", start: prevStart, end: prevEnd };
}

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00`).getTime();
  const end = new Date(`${endIso}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function isWithinRange(dateIso: string, range: DateRange): boolean {
  return dateIso >= range.start && dateIso <= range.end;
}

export function filterContent(
  items: ContentItem[],
  filters: DashboardFilters,
): ContentItem[] {
  const search = filters.search.trim().toLowerCase();
  return items.filter((item) => {
    if (!isWithinRange(item.publishDate, filters.dateRange)) return false;
    if (filters.campaign.length && !filters.campaign.includes(item.campaignId)) return false;
    if (filters.product.length && !filters.product.includes(item.product)) return false;
    if (filters.approach.length && !filters.approach.includes(item.approach)) return false;
    if (
      filters.contentType.length &&
      !filters.contentType.includes(item.contentType)
    )
      return false;
    if (filters.platform.length && !filters.platform.includes(item.platform))
      return false;
    if (search) {
      const haystack = `${item.title} ${item.caption} ${item.product} ${item.creator} ${item.id}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function filterPerformanceByDate(
  records: DailyPerformanceRecord[],
  range: DateRange,
): DailyPerformanceRecord[] {
  return records.filter((r) => isWithinRange(r.date, range));
}
