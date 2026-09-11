"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatCompactNumber,
  formatExactNumber,
  formatPercent,
} from "@/lib/formatters";
import type { CampaignMeta } from "@/lib/campaigns";
import type { ClassificationBreakdown, ClassificationDimension } from "@/lib/types";
import { EmptyState } from "./EmptyState";

const BASE_DIMENSIONS: { id: ClassificationDimension; label: string }[] = [
  { id: "product", label: "Product" },
  { id: "approach", label: "Approach" },
  { id: "contentType", label: "Content Type" },
  { id: "platform", label: "Platform" },
];
const CAMPAIGN_DIMENSION = { id: "campaign" as ClassificationDimension, label: "Campaign" };

export function ClassificationPerformance({
  dimension,
  breakdown,
  campaigns,
  showCampaignDimension,
  onDimensionChange,
}: {
  dimension: ClassificationDimension;
  breakdown: ClassificationBreakdown[];
  campaigns: CampaignMeta[];
  showCampaignDimension?: boolean;
  onDimensionChange: (d: ClassificationDimension) => void;
}) {
  const maxViews = Math.max(1, ...breakdown.map((b) => b.views));
  const dimensions = showCampaignDimension
    ? [...BASE_DIMENSIONS, CAMPAIGN_DIMENSION]
    : BASE_DIMENSIONS;
  const campaignNameById = new Map(campaigns.map((c) => [c.id, c.name]));
  const displayKey = (key: string) =>
    dimension === "campaign" ? (campaignNameById.get(key) ?? key) : key;

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Performance by Classification
          </h2>
          <p className="text-sm text-foreground-muted">
            Ranked by total views within the current filters.
          </p>
        </div>
        <Tabs value={dimension} onValueChange={(v) => onDimensionChange(v as ClassificationDimension)}>
          <TabsList>
            {dimensions.map((d) => (
              <TabsTrigger key={d.id} value={d.id}>
                {d.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4">
        {breakdown.length === 0 ? (
          <EmptyState
            title="No content matches these filters"
            description="Try widening the date range or clearing a filter."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {breakdown.map((row) => (
              <li key={row.key} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <span className="text-sm font-medium text-foreground">{displayKey(row.key)}</span>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs text-foreground-muted">
                    <span title={formatExactNumber(row.views)}>
                      <strong className="tabular-nums font-semibold text-foreground">
                        {formatCompactNumber(row.views)}
                      </strong>{" "}
                      views
                    </span>
                    <span title={formatExactNumber(row.totalEngagements)}>
                      <strong className="tabular-nums font-semibold text-foreground">
                        {formatCompactNumber(row.totalEngagements)}
                      </strong>{" "}
                      engagements
                    </span>
                    <span>
                      <strong className="tabular-nums font-semibold text-foreground">
                        {formatPercent(row.engagementRate)}
                      </strong>{" "}
                      ER
                    </span>
                    <span>
                      <strong className="tabular-nums font-semibold text-foreground">
                        {row.contentCount}
                      </strong>{" "}
                      posts
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(2, (row.views / maxViews) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
