"use client";

import { useMemo } from "react";
import { CAMPAIGNS } from "@/lib/campaigns";
import { buildCampaignCompareEntries, buildComparisonRows } from "@/lib/compare";
import type { ChartGranularity, ChartMetric, ContentItem } from "@/lib/types";
import { CompareTrendChart } from "./CompareTrendChart";
import { CompareStatsTable } from "./CompareStatsTable";
import { EmptyState } from "./EmptyState";

export function CompareView({
  allContent,
  campaignIds,
  granularity,
  metric,
  onCampaignIdsChange,
  onGranularityChange,
  onMetricChange,
}: {
  allContent: ContentItem[];
  campaignIds: string[];
  granularity: ChartGranularity;
  metric: ChartMetric;
  onCampaignIdsChange: (ids: string[]) => void;
  onGranularityChange: (g: ChartGranularity) => void;
  onMetricChange: (m: ChartMetric) => void;
}) {
  const canCompare = CAMPAIGNS.length >= 2;
  const idA = campaignIds[0] ?? CAMPAIGNS[0]?.id ?? "";
  const idB = canCompare
    ? (campaignIds[1] ?? CAMPAIGNS.find((c) => c.id !== idA)?.id ?? CAMPAIGNS[1].id)
    : idA;

  const entries = useMemo(
    () => (canCompare ? buildCampaignCompareEntries(allContent, [idA, idB], granularity) : []),
    [canCompare, allContent, idA, idB, granularity],
  );
  const rows = useMemo(() => buildComparisonRows(entries), [entries]);

  if (!canCompare) {
    return (
      <EmptyState
        className="min-h-[320px]"
        title="Add a second campaign to compare"
        description="Compare mode needs at least two campaigns registered. Once a second campaign's data is wired up, it'll show up here automatically."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-3 sm:flex-row sm:items-center sm:gap-4">
        <CampaignSelect
          label="Campaign A"
          value={idA}
          exclude={idB}
          onChange={(next) => onCampaignIdsChange([next, idB])}
        />
        <span className="text-sm font-medium text-foreground-subtle">vs</span>
        <CampaignSelect
          label="Campaign B"
          value={idB}
          exclude={idA}
          onChange={(next) => onCampaignIdsChange([idA, next])}
        />
      </div>

      <CompareTrendChart
        entries={entries}
        granularity={granularity}
        metric={metric}
        onGranularityChange={onGranularityChange}
        onMetricChange={onMetricChange}
      />

      <CompareStatsTable entries={entries} rows={rows} />
    </div>
  );
}

function CampaignSelect({
  label,
  value,
  exclude,
  onChange,
}: {
  label: string;
  value: string;
  exclude: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex flex-1 items-center gap-2">
      <span className="text-xs font-medium text-foreground-subtle">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 text-sm text-foreground"
      >
        {CAMPAIGNS.filter((c) => c.id !== exclude).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
