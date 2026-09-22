"use client";

import { useMemo } from "react";
import { useDashboardState } from "@/lib/use-dashboard-state";
import {
  getClassificationPerformance,
  getContentPerformance,
  getDashboardSummary,
  getFilterOptions,
  getPerformanceTimeline,
  getTotalContentCount,
  sortContent,
} from "@/lib/data";
import { findCampaignMeta, type CampaignMeta } from "@/lib/campaigns";
import type { ContentItem } from "@/lib/types";
import { DashboardHeader } from "./DashboardHeader";
import { DateRangePicker } from "./DateRangePicker";
import { CampaignSwitcher } from "./CampaignSwitcher";
import { FilterBar } from "./FilterBar";
import { KPIOverview } from "./KPIOverview";
import { PerformanceChart } from "./PerformanceChart";
import { ClassificationPerformance } from "./ClassificationPerformance";
import { ContentLibrary } from "./ContentLibrary";
import { ContentDetailDrawer } from "./ContentDetailDrawer";
import { CompareView } from "./CompareView";

export function DashboardShell({
  content,
  campaigns,
}: {
  content: ContentItem[];
  campaigns: CampaignMeta[];
}) {
  const state = useDashboardState(content, campaigns);
  const isAllMode = state.mode === "all";
  const campaignScope = useMemo(
    () => (isAllMode ? undefined : [state.activeCampaignId]),
    [isAllMode, state.activeCampaignId],
  );

  const filterOptions = useMemo(
    () => getFilterOptions(content, campaignScope),
    [content, campaignScope],
  );
  const totalUnfiltered = useMemo(
    () => getTotalContentCount(content, campaignScope),
    [content, campaignScope],
  );

  const filteredContent = useMemo(
    () => getContentPerformance(content, state.filters),
    [content, state.filters],
  );
  const sortedContent = useMemo(
    () => sortContent(filteredContent, state.sortBy),
    [filteredContent, state.sortBy],
  );
  const summary = useMemo(
    () => getDashboardSummary(content, state.filters),
    [content, state.filters],
  );
  const timeline = useMemo(
    () => getPerformanceTimeline(content, state.filters, state.chartGranularity),
    [content, state.filters, state.chartGranularity],
  );
  const classificationBreakdown = useMemo(
    () => getClassificationPerformance(content, state.classificationDimension, state.filters),
    [content, state.classificationDimension, state.filters],
  );
  const contentById = useMemo(() => new Map(content.map((c) => [c.id, c])), [content]);
  const selectedContent = state.selectedContentId
    ? (contentById.get(state.selectedContentId) ?? null)
    : null;

  const activeCampaignMeta = findCampaignMeta(campaigns, state.activeCampaignId);
  const headerEyebrow =
    state.mode === "all"
      ? "All Campaigns"
      : state.mode === "compare"
        ? "Compare Campaigns"
        : activeCampaignMeta
          ? `${activeCampaignMeta.productLabel} · ${activeCampaignMeta.name}`
          : "No Campaign Data";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <DashboardHeader dataAsOf={state.dateBounds.maxDate} eyebrow={headerEyebrow}>
        {state.mode !== "compare" && (
          <DateRangePicker
            preset={state.dateRangePreset}
            range={state.filters.dateRange}
            bounds={state.dateBounds}
            onPresetChange={state.setDateRangePreset}
            onCustomChange={state.setCustomDateRange}
          />
        )}
      </DashboardHeader>

      <CampaignSwitcher
        campaigns={campaigns}
        mode={state.mode}
        activeCampaignId={state.activeCampaignId}
        onModeChange={state.setMode}
        onCampaignChange={state.setActiveCampaignId}
      />

      {state.mode === "compare" ? (
        <CompareView
          allContent={content}
          campaigns={campaigns}
          campaignIds={state.compareCampaignIds}
          granularity={state.chartGranularity}
          metric={state.chartMetric}
          onCampaignIdsChange={state.setCompareCampaignIds}
          onGranularityChange={state.setChartGranularity}
          onMetricChange={state.setChartMetric}
        />
      ) : (
        <>
          <FilterBar
            options={filterOptions}
            filters={state.filters}
            hasActiveFilters={state.hasActiveFilters}
            showCampaignFilter={isAllMode}
            campaigns={campaigns}
            onCampaignChange={state.setAllModeCampaigns}
            onProductChange={state.setProductFilter}
            onApproachChange={state.setApproachFilter}
            onContentTypeChange={state.setContentTypeFilter}
            onPlatformChange={state.setPlatformFilter}
            onSearchChange={state.setSearch}
            onClear={state.clearFilters}
          />

          <KPIOverview summary={summary} />

          <PerformanceChart
            data={timeline}
            granularity={state.chartGranularity}
            metric={state.chartMetric}
            onGranularityChange={state.setChartGranularity}
            onMetricChange={state.setChartMetric}
          />

          <ClassificationPerformance
            dimension={state.classificationDimension}
            breakdown={classificationBreakdown}
            campaigns={campaigns}
            showCampaignDimension={isAllMode}
            onDimensionChange={state.setClassificationDimension}
          />

          <ContentLibrary
            items={sortedContent}
            totalUnfiltered={totalUnfiltered}
            sortBy={state.sortBy}
            viewMode={state.viewMode}
            onSortChange={state.setSortBy}
            onViewModeChange={state.setViewMode}
            onSelect={state.setSelectedContentId}
            onClearFilters={state.clearFilters}
          />

          <ContentDetailDrawer
            item={selectedContent}
            onOpenChange={(open) => {
              if (!open) state.setSelectedContentId(null);
            }}
          />
        </>
      )}
    </div>
  );
}
