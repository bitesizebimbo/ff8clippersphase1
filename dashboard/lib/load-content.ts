import "server-only";

import ff8Phase1Raw from "@/data/campaigns/ff8-clippers-phase1.json";
import { toContentItem } from "./analytics";
import { LIVE_CAMPAIGN_SOURCES, STATIC_CAMPAIGNS, type CampaignMeta } from "./campaigns";
import { fetchSheetCampaignRecords } from "./google-sheets";
import type { ContentItem, RawContentRecord } from "./types";

const STATIC_CAMPAIGN_DATA: Record<string, RawContentRecord[]> = {
  "ff8-clippers-phase1": ff8Phase1Raw as RawContentRecord[],
};

export interface LoadedDashboardData {
  content: ContentItem[];
  campaigns: CampaignMeta[];
}

/**
 * Assembles the full content set for one request: static (checked-in JSON)
 * campaigns plus any live (Google Sheet) campaigns whose fetch actually
 * returned rows. A live campaign that fails or isn't configured yet simply
 * doesn't appear — see lib/google-sheets.ts for why that's never an error
 * that surfaces to the user.
 */
export async function loadAllContent(): Promise<LoadedDashboardData> {
  const staticContent = STATIC_CAMPAIGNS.flatMap((c) =>
    (STATIC_CAMPAIGN_DATA[c.id] ?? []).map(toContentItem),
  );

  const liveResults = await Promise.all(
    LIVE_CAMPAIGN_SOURCES.map(async (source) => {
      const records = await fetchSheetCampaignRecords({
        campaignId: source.id,
        spreadsheetId: source.sheet.spreadsheetId,
        sheetName: source.sheet.sheetName,
      });
      return { source, records };
    }),
  );

  const liveWithData = liveResults.filter((r) => r.records.length > 0);
  const liveContent = liveWithData.flatMap((r) => r.records.map(toContentItem));

  const campaigns: CampaignMeta[] = [
    ...STATIC_CAMPAIGNS,
    ...liveWithData.map(({ source }) => ({
      id: source.id,
      name: source.name,
      shortLabel: source.shortLabel,
      productLabel: source.productLabel,
    })),
  ];

  return { content: [...staticContent, ...liveContent], campaigns };
}
