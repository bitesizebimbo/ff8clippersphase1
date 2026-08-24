"use client";

import { useMemo } from "react";
import { useDashboardState } from "@/lib/use-dashboard-state";
import {
  getClassificationPerformance,
  getContentById,
  getContentPerformance,
  getDashboardSummary,
  getDatasetDateBounds,
  getFilterOptions,
  getPerformanceTimeline,
  getTotalContentCount,
  sortContent,
} from "@/lib/data";
import { DashboardHeader } from "./DashboardHeader";
import { DateRangePicker } from "./DateRangePicker";
import { FilterBar } from "./FilterBar";
import { KPIOverview } from "./KPIOverview";
import { PerformanceChart } from "./PerformanceChart";
import { ClassificationPerformance } from "./ClassificationPerformance";
import { ContentLibrary } from "./ContentLibrary";
import { ContentDetailDrawer } from "./ContentDetailDrawer";

export function DashboardShell() {
  const state = useDashboardState();
  const bounds = getDatasetDateBounds();
  const filterOptions = useMemo(() => getFilterOptions(), []);
  const totalUnfiltered = getTotalContentCount();

  const filteredContent = useMemo(
    () => getContentPerformance(state.filters),
    [state.filters],
  );
  const sortedContent = useMemo(
    () => sortContent(filteredContent, state.sortBy),
    [filteredContent, state.sortBy],
  );
  const summary = useMemo(
    () => getDashboardSummary(state.filters),
    [state.filters],
  );
  const timeline = useMemo(
    () => getPerformanceTimeline(state.filters, state.chartGranularity),
    [state.filters, state.chartGranularity],
  );
  const classificationBreakdown = useMemo(
    () => getClassificationPerformance(state.classificationDimension, state.filters),
    [state.classificationDimension, state.filters],
  );
  const selectedContent = state.selectedContentId
    ? (getContentById(state.selectedContentId) ?? null)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <DashboardHeader dataAsOf={bounds.maxDate}>
        <DateRangePicker
          preset={state.dateRangePreset}
          range={state.filters.dateRange}
          bounds={bounds}
          onPresetChange={state.setDateRangePreset}
          onCustomChange={state.setCustomDateRange}
        />
      </DashboardHeader>

      <FilterBar
        options={filterOptions}
        filters={state.filters}
        hasActiveFilters={state.hasActiveFilters}
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
    </div>
  );
}
