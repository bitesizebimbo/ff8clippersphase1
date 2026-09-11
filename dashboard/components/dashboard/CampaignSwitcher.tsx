"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CampaignMeta } from "@/lib/campaigns";
import type { DashboardMode } from "@/lib/types";

export function CampaignSwitcher({
  campaigns,
  mode,
  activeCampaignId,
  onModeChange,
  onCampaignChange,
}: {
  campaigns: CampaignMeta[];
  mode: DashboardMode;
  activeCampaignId: string;
  onModeChange: (mode: DashboardMode) => void;
  onCampaignChange: (id: string) => void;
}) {
  const canCompare = campaigns.length >= 2;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as DashboardMode)}>
        <TabsList aria-label="Dashboard mode">
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="all">All Campaigns</TabsTrigger>
          <TabsTrigger
            value="compare"
            disabled={!canCompare}
            title={canCompare ? undefined : "Add a second campaign to enable comparison"}
          >
            Compare
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === "single" && campaigns.length > 1 && (
        <select
          value={activeCampaignId}
          onChange={(e) => onCampaignChange(e.target.value)}
          aria-label="Active campaign"
          className="h-9 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 text-sm text-foreground"
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
