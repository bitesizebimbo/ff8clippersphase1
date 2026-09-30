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

// Each group is deployed as its own dashboard (a separate Vercel project
// from this same repo), picked by the DASHBOARD_GROUP env var — see
// dashboardGroup() and the README's "Clippers and OA dashboards". Each
// group's sheets are shared with that group's own service account, whose
// key lives under that group's own env var names, so both keys can sit
// side by side in one environment.
export const DASHBOARD_GROUPS = {
  clippers: {
    title: "Samsung Clippers",
    emailEnv: "GOOGLE_SHEETS_CLIENT_EMAIL",
    keyEnv: "GOOGLE_SHEETS_PRIVATE_KEY",
  },
  oa: {
    title: "Samsung OA",
    emailEnv: "OA_GOOGLE_SHEETS_CLIENT_EMAIL",
    keyEnv: "OA_GOOGLE_SHEETS_PRIVATE_KEY",
  },
} as const;

export type DashboardGroup = keyof typeof DASHBOARD_GROUPS;

/**
 * The group this deployment shows, from DASHBOARD_GROUP. Unset means
 * "clippers", so the existing deployment keeps working unchanged. Server
 * side only — the env var isn't exposed to the browser.
 */
export function dashboardGroup(): DashboardGroup {
  const raw = process.env.DASHBOARD_GROUP?.trim().toLowerCase() || "clippers";
  if (!(raw in DASHBOARD_GROUPS)) {
    throw new Error(
      `DASHBOARD_GROUP="${process.env.DASHBOARD_GROUP}" isn't one of: ${Object.keys(DASHBOARD_GROUPS).join(", ")}`,
    );
  }
  return raw as DashboardGroup;
}

export interface LiveCampaignSource extends CampaignMeta {
  group: DashboardGroup;
  sheet: {
    spreadsheetId: string;
    sheetName: string;
  };
}

export const LIVE_CAMPAIGN_SOURCES: LiveCampaignSource[] = [
  {
    id: "ff8-clippers-phase1",
    group: "clippers",
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
    group: "clippers",
    name: "Fold 8 Clippers Launch Phase 2",
    shortLabel: "Fold8 Phase 2",
    productLabel: "Samsung Galaxy Z Fold8",
    sheet: {
      spreadsheetId: "1qfs2syaaIPxTHe38oGHYoUxQMn9zL9iF24vN0NRHd8g",
      sheetName: "Performance Clippers",
    },
  },
  {
    // Previously two campaigns (r14-rnpl, r14-launch) from two separate
    // tabs in this same spreadsheet — the team consolidated RNPL and Launch
    // tracking into one tab, so this is now a single combined campaign.
    id: "r14",
    group: "clippers",
    name: "R14 RNPL & Launch",
    shortLabel: "R14",
    productLabel: "R14",
    sheet: {
      spreadsheetId: "1w4b63lHvvraZVo7q3t9kaXjhjgGxj4U7PsIPndaxEHU",
      sheetName: "PERFORMANCE RNPL & LAUNCH ONGOING",
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
