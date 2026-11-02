// Flagship Consumer Journey: per product, how many posts went out and how
// many views they got at each stage of the consumer journey framework,
// against the daily plan in that product's "Master Daily Breakdown" tab.
//
// Targets are read server-side (fetchJourneyTargets in lib/google-sheets.ts);
// actuals are the same posts the rest of the dashboard shows, tagged by the
// performance sheets' "Consumer Journey" column.

import { contentWeek, formatWeekLabel } from "./analytics";
import type { ContentItem } from "./types";

export const JOURNEY_STAGES = [
  "Awareness",
  "Engagement",
  "Store Traffic",
  "User Experience",
  "Advocacy",
  "Conversion",
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

// The sheets' own tags for a stage, lowercased. The two in use so far
// ("Product Engagement", "Drive to Store") predate the framework's names.
const TAG_TO_STAGE: Record<string, JourneyStage> = {
  awareness: "Awareness",
  engagement: "Engagement",
  "product engagement": "Engagement",
  "store traffic": "Store Traffic",
  "drive to store": "Store Traffic",
  "user experience": "User Experience",
  advocacy: "Advocacy",
  conversion: "Conversion",
};

export function journeyStage(tag: string): JourneyStage | null {
  return TAG_TO_STAGE[tag.trim().toLowerCase().replace(/\s+/g, " ")] ?? null;
}

export interface JourneyProduct {
  id: string;
  label: string;
  /** First day counted, ISO date. */
  startDate: string;
  /** Posts come from this campaign's performance sheet… */
  campaignId: string;
  /** …limited to this Product value, when set. */
  product?: string;
  /** The tab with the daily plan, found by its gid so a rename doesn't break it. */
  target: { spreadsheetId: string; gid: number };
}

export const JOURNEY_PRODUCTS: JourneyProduct[] = [
  {
    id: "s26fe",
    label: "Galaxy S26 FE",
    startDate: "2026-10-12",
    campaignId: "r14",
    product: "Galaxy S26FE",
    target: { spreadsheetId: "1w4b63lHvvraZVo7q3t9kaXjhjgGxj4U7PsIPndaxEHU", gid: 1703495528 },
  },
  {
    id: "ff8",
    label: "FF8",
    startDate: "2026-10-06",
    campaignId: "fold8-clippers-phase2",
    target: { spreadsheetId: "1zT9sl22QlRmytv3QSreIPhoL5oOCiB-uXj-qlgB1xJo", gid: 375386279 },
  },
  {
    id: "s26u",
    label: "Galaxy S26 Ultra",
    startDate: "2026-10-12",
    campaignId: "s26-ultra",
    product: "Galaxy S26 Ultra",
    target: { spreadsheetId: "1o9PPQ8QmIHoJkCYtJRnNFqA3Ba0OJWUt1uMr_2CE3uo", gid: 904364779 },
  },
];

/** One planned post from a Master Daily Breakdown tab. */
export interface JourneyTargetRow {
  productId: string;
  date: string;
  week?: number;
  stage: JourneyStage | null;
  views: number;
}

export interface JourneyTargets {
  rows: JourneyTargetRow[];
  /** Products whose target tab couldn't be read (e.g. not shared with the service account). */
  unavailable: string[];
}

export type JourneyGranularity = "weekly" | "monthly";

export interface JourneyPoint {
  label: string;
  targetPosts: number;
  actualPosts: number;
  targetViews: number;
  actualViews: number;
}

export function journeyProductFor(item: ContentItem): JourneyProduct | undefined {
  return JOURNEY_PRODUCTS.find(
    (p) =>
      p.campaignId === item.campaignId &&
      (!p.product || p.product === item.product) &&
      item.publishDate >= p.startDate,
  );
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucketOf(date: string, week: number | undefined, granularity: JourneyGranularity) {
  if (granularity === "monthly") {
    return { key: date.slice(0, 7), label: `${MONTH[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}` };
  }
  const wk = week ?? contentWeek({ publishDate: date });
  return { key: `${date.slice(0, 4)}-${String(wk).padStart(2, "0")}`, label: formatWeekLabel(wk) };
}

/**
 * Target vs actual per week or month for the chosen products and stage
 * ("all" = every post, tagged or not). Targets run only up to `throughDate`,
 * so the current week or month compares like with like.
 */
export function buildJourneyTimeline(
  content: ContentItem[],
  targets: JourneyTargetRow[],
  productIds: string[],
  stage: JourneyStage | "all",
  granularity: JourneyGranularity,
  throughDate: string,
): JourneyPoint[] {
  const buckets = new Map<string, JourneyPoint>();
  const bucket = (date: string, week: number | undefined) => {
    const { key, label } = bucketOf(date, week, granularity);
    let point = buckets.get(key);
    if (!point) {
      point = { label, targetPosts: 0, actualPosts: 0, targetViews: 0, actualViews: 0 };
      buckets.set(key, point);
    }
    return point;
  };

  const products = new Map(JOURNEY_PRODUCTS.map((p) => [p.id, p]));
  for (const row of targets) {
    const product = products.get(row.productId);
    if (!product || !productIds.includes(row.productId)) continue;
    if (row.date < product.startDate || row.date > throughDate) continue;
    if (stage !== "all" && row.stage !== stage) continue;
    const point = bucket(row.date, row.week);
    point.targetPosts += 1;
    point.targetViews += row.views;
  }

  for (const item of content) {
    const product = journeyProductFor(item);
    if (!product || !productIds.includes(product.id)) continue;
    if (stage !== "all" && journeyStage(item.consumerJourney) !== stage) continue;
    const point = bucket(item.publishDate, item.week);
    point.actualPosts += 1;
    point.actualViews += item.views;
  }

  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, p]) => p);
}
