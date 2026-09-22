// Campaign registry. Two kinds of source:
//
// - STATIC_CAMPAIGNS ship their data as a checked-in JSON file
//   (data/campaigns/<id>.json) and are always available.
// - LIVE_CAMPAIGN_SOURCES are fetched from a Google Sheet at request time
//   (see lib/google-sheets.ts, lib/load-content.ts) and only appear in the
//   dashboard once that sheet is actually reachable — see loadAllContent().
//   This avoids showing a broken, empty campaign in the switcher while its
//   credentials/sharing are still being set up.
//
// Either way, the resolved list (lib/load-content.ts's `campaigns`) is what
// every component actually renders from — nothing here is imported directly
// by client components.

export interface CampaignMeta {
  id: string;
  name: string;
  /** Short label for compact UI (switcher chips, chart legends). */
  shortLabel: string;
  productLabel: string;
}

// No campaigns are static right now — FF8 Phase 1 moved to a live sheet
// below. Kept as an array (not removed) since a future campaign may again
// ship as checked-in JSON, and nothing else needs to change to support that.
export const STATIC_CAMPAIGNS: CampaignMeta[] = [];

export interface LiveCampaignSource extends CampaignMeta {
  sheet: {
    spreadsheetId: string;
    sheetName: string;
  };
}

export const LIVE_CAMPAIGN_SOURCES: LiveCampaignSource[] = [
  {
    id: "ff8-clippers-phase1",
    name: "FF8 Clippers Phase 1",
    shortLabel: "FF8 Phase 1",
    productLabel: "Samsung Galaxy Z Fold8 / Z Flip8",
    sheet: {
      spreadsheetId: "1WhaIbd4rQERTSAskXcTAuBssXpdJe0VN1Q0UKcuAE-8",
      sheetName: "Performance CORRECT CLAUDE",
    },
  },
  {
    id: "fold8-clippers-phase2",
    name: "Fold 8 Clippers Launch Phase 2",
    shortLabel: "Fold8 Phase 2",
    productLabel: "Samsung Galaxy Z Fold8",
    sheet: {
      spreadsheetId: "1qfs2syaaIPxTHe38oGHYoUxQMn9zL9iF24vN0NRHd8g",
      sheetName: "Performance Clippers",
    },
  },
  {
    id: "r14-rnpl",
    name: "R14 RNPL Performance",
    shortLabel: "R14 RNPL",
    productLabel: "R14",
    sheet: {
      spreadsheetId: "1w4b63lHvvraZVo7q3t9kaXjhjgGxj4U7PsIPndaxEHU",
      sheetName: "1. RNPL - Performance",
    },
  },
  {
    id: "r14-launch",
    name: "R14 Launch Performance",
    shortLabel: "R14 Launch",
    productLabel: "R14",
    sheet: {
      spreadsheetId: "1w4b63lHvvraZVo7q3t9kaXjhjgGxj4U7PsIPndaxEHU",
      sheetName: "2. Launch Offer - Performance",
    },
  },
];

export function findCampaignMeta(
  campaigns: CampaignMeta[],
  id: string,
): CampaignMeta | undefined {
  return campaigns.find((c) => c.id === id);
}

// A *preference*, not a guarantee — every campaign is now fetched live, so
// none is guaranteed to have loaded successfully for any given request. See
// resolveDefaultCampaignId, which is what code should actually call.
const PREFERRED_DEFAULT_CAMPAIGN_ID = "ff8-clippers-phase1";

/**
 * The campaign Single mode should default to: the preferred one if it
 * actually loaded this request, otherwise whichever campaign did load, so
 * the dashboard never defaults to an empty view over one failed fetch.
 * Returns null only when nothing loaded at all.
 */
export function resolveDefaultCampaignId(campaigns: CampaignMeta[]): string | null {
  if (campaigns.some((c) => c.id === PREFERRED_DEFAULT_CAMPAIGN_ID)) {
    return PREFERRED_DEFAULT_CAMPAIGN_ID;
  }
  return campaigns[0]?.id ?? null;
}
