// Campaign registry. Each entry describes one campaign's identity; its
// content lives in data/campaigns/<id>.json (or, once wired up, a live
// Google Sheet — see lib/data.ts). Adding a campaign here plus a matching
// data source is the only step needed to make it selectable everywhere in
// the dashboard (switcher, All mode, Compare mode).

export interface CampaignMeta {
  id: string;
  name: string;
  /** Short label for compact UI (switcher chips, chart legends). */
  shortLabel: string;
  productLabel: string;
}

export const CAMPAIGNS: CampaignMeta[] = [
  {
    id: "ff8-clippers-phase1",
    name: "FF8 Clippers Phase 1",
    shortLabel: "FF8 Phase 1",
    productLabel: "Samsung Galaxy Z Fold8 / Z Flip8",
  },
];

export function getCampaignMeta(id: string): CampaignMeta | undefined {
  return CAMPAIGNS.find((c) => c.id === id);
}

export const DEFAULT_CAMPAIGN_ID = CAMPAIGNS[0].id;
