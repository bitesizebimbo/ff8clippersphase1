// Period snapshot: totals, CXP angles and top posts for a hand-picked set of
// reporting weeks (or months), optionally against a second set.

import { contentWeek, formatWeekLabel } from "./analytics";
import type { ContentItem } from "./types";

export type PeriodGranularity = "weekly" | "monthly";

export interface PeriodOption {
  key: string;
  label: string;
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function periodOf(item: ContentItem, granularity: PeriodGranularity): PeriodOption {
  if (granularity === "monthly") {
    const d = item.publishDate;
    return { key: d.slice(0, 7), label: `${MONTH[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` };
  }
  const week = contentWeek(item);
  return { key: `${item.publishDate.slice(0, 4)}-${String(week).padStart(2, "0")}`, label: formatWeekLabel(week) };
}

/** Every period that has posts, newest first. */
export function periodOptions(items: ContentItem[], granularity: PeriodGranularity): PeriodOption[] {
  const byKey = new Map<string, PeriodOption>();
  for (const item of items) {
    const p = periodOf(item, granularity);
    byKey.set(p.key, p);
  }
  return [...byKey.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** Posts in the chosen periods; no periods chosen = all of them. */
export function itemsInPeriods(
  items: ContentItem[],
  granularity: PeriodGranularity,
  keys: string[],
): ContentItem[] {
  if (keys.length === 0) return items;
  return items.filter((item) => keys.includes(periodOf(item, granularity).key));
}

export interface PeriodStats {
  posts: number;
  views: number;
  engagements: number;
  engagementRate: number;
  avgViews: number;
  top: ContentItem | null;
  firstDate: string;
  lastDate: string;
}

export function periodStats(items: ContentItem[]): PeriodStats {
  let views = 0;
  let engagements = 0;
  let top: ContentItem | null = null;
  let firstDate = "";
  let lastDate = "";
  for (const item of items) {
    views += item.views;
    engagements += item.totalEngagements;
    if (!top || item.views > top.views) top = item;
    if (!firstDate || item.publishDate < firstDate) firstDate = item.publishDate;
    if (!lastDate || item.publishDate > lastDate) lastDate = item.publishDate;
  }
  return {
    posts: items.length,
    views,
    engagements,
    engagementRate: views ? engagements / views : 0,
    avgViews: items.length ? views / items.length : 0,
    top,
    firstDate,
    lastDate,
  };
}

export interface AngleRow {
  angle: string;
  stats: PeriodStats;
}

/** One row per CXP angle (blank CXP grouped as "No CXP"). */
export function anglePerformance(items: ContentItem[]): AngleRow[] {
  const groups = new Map<string, ContentItem[]>();
  for (const item of items) {
    const angle = item.cxp.trim() || "No CXP";
    const list = groups.get(angle);
    if (list) list.push(item);
    else groups.set(angle, [item]);
  }
  return [...groups.entries()].map(([angle, list]) => ({ angle, stats: periodStats(list) }));
}

export type PostMetric = "views" | "totalEngagements" | "engagementRate" | "likes" | "comments" | "shares" | "saves";

export function topBy(items: ContentItem[], metric: PostMetric, n: number): ContentItem[] {
  return [...items].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0) || b.views - a.views).slice(0, n);
}
