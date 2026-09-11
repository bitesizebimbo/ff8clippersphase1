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

export const STATIC_CAMPAIGNS: CampaignMeta[] = [
  {
    id: "ff8-clippers-phase1",
    name: "FF8 Clippers Phase 1",
    shortLabel: "FF8 Phase 1",
    productLabel: "Samsung Galaxy Z Fold8 / Z Flip8",
  },
];

export interface LiveCampaignSource extends CampaignMeta {
  sheet: {
    spreadsheetId: string;
    sheetName: string;
  };
}

export const LIVE_CAMPAIGN_SOURCES: LiveCampaignSource[] = [
  {
    id: "fold8-clippers-phase2",
    name: "Fold 8 Clippers Launch Phase 2",
    shortLabel: "Fold8 Phase 2",
    productLabel: "Samsung Galaxy Z Fold8",
    sheet: {
      spreadsheetId: "1qfs2syaaIPxTHe38oGHYoUxQMn9zL9iF24vN0NRHd8g",
      sheetName: "performance clippers",
    },
  },
];

export function findCampaignMeta(
  campaigns: CampaignMeta[],
  id: string,
): CampaignMeta | undefined {
  return campaigns.find((c) => c.id === id);
}

export const DEFAULT_CAMPAIGN_ID = STATIC_CAMPAIGNS[0].id;
