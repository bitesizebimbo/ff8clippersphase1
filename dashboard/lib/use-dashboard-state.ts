"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getDateBounds, resolveDateRange } from "./data";
import { DEFAULT_CAMPAIGN_ID } from "./campaigns";
import { MAX_COMPARE_CAMPAIGNS } from "./compare";
import type {
  ChartGranularity,
  ChartMetric,
  ClassificationDimension,
  DashboardFilters,
  DashboardMode,
  DatePreset,
  SortOption,
  ViewMode,
} from "./types";

const DEFAULTS = {
  mode: "single" as DashboardMode,
  range: "all" as DatePreset,
  granularity: "daily" as ChartGranularity,
  metric: "views" as ChartMetric,
  sort: "views-desc" as SortOption,
  view: "grid" as ViewMode,
  dimension: "product" as ClassificationDimension,
};

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

/**
 * Single source of dashboard UI state, backed entirely by URL search
 * params. This makes every filtered/sorted/scoped view of the dashboard a
 * shareable link (e.g. ?platform=TikTok&range=last7&sort=engagementRate-desc)
 * with no separate client store to keep in sync.
 */
export function useDashboardState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mode = (searchParams.get("mode") as DashboardMode) || DEFAULTS.mode;
  const activeCampaignId = searchParams.get("campaign") || DEFAULT_CAMPAIGN_ID;
  const allModeCampaigns = parseList(searchParams.get("campaigns"));
  const compareCampaignIds = parseList(searchParams.get("compare")).slice(
    0,
    MAX_COMPARE_CAMPAIGNS,
  );

  // Single mode is scoped to one campaign's own date bounds; All mode spans
  // every campaign. Compare mode ignores date bounds entirely (see lib/compare.ts).
  const dateBounds = useMemo(
    () => (mode === "single" ? getDateBounds([activeCampaignId]) : getDateBounds()),
    [mode, activeCampaignId],
  );

  const presetParam = (searchParams.get("range") as DatePreset) || DEFAULTS.range;
  const customStart = searchParams.get("start");
  const customEnd = searchParams.get("end");

  const dateRange = useMemo(() => {
    if (presetParam === "custom" && customStart && customEnd) {
      return resolveDateRange("custom", { start: customStart, end: customEnd }, dateBounds);
    }
    return resolveDateRange(presetParam, undefined, dateBounds);
  }, [presetParam, customStart, customEnd, dateBounds]);

  const campaignFilter = mode === "single" ? [activeCampaignId] : allModeCampaigns;

  const filters: DashboardFilters = useMemo(
    () => ({
      dateRange,
      campaign: campaignFilter,
      product: parseList(searchParams.get("product")),
      approach: parseList(searchParams.get("approach")),
      contentType: parseList(searchParams.get("type")),
      platform: parseList(searchParams.get("platform")),
      search: searchParams.get("q") ?? "",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateRange, searchParams, mode, activeCampaignId],
  );

  const chartGranularity =
    (searchParams.get("granularity") as ChartGranularity) || DEFAULTS.granularity;
  const chartMetric = (searchParams.get("metric") as ChartMetric) || DEFAULTS.metric;
  const sortBy = (searchParams.get("sort") as SortOption) || DEFAULTS.sort;
  const viewMode = (searchParams.get("view") as ViewMode) || DEFAULTS.view;
  const classificationDimension =
    (searchParams.get("dimension") as ClassificationDimension) || DEFAULTS.dimension;
  const selectedContentId = searchParams.get("content");

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const hasActiveFilters =
    filters.product.length > 0 ||
    filters.approach.length > 0 ||
    filters.contentType.length > 0 ||
    filters.platform.length > 0 ||
    filters.search.length > 0 ||
    presetParam !== "all" ||
    (mode === "all" && allModeCampaigns.length > 0);

  return {
    mode,
    activeCampaignId,
    allModeCampaigns,
    compareCampaignIds,
    dateBounds,
    filters,
    dateRangePreset: presetParam,
    chartGranularity,
    chartMetric,
    sortBy,
    viewMode,
    classificationDimension,
    selectedContentId,
    hasActiveFilters,

    setMode: (m: DashboardMode) => setParams({ mode: m === "single" ? null : m }),
    setActiveCampaignId: (id: string) => setParams({ campaign: id }),
    setAllModeCampaigns: (ids: string[]) => setParams({ campaigns: ids.join(",") || null }),
    setCompareCampaignIds: (ids: string[]) =>
      setParams({ compare: ids.slice(0, MAX_COMPARE_CAMPAIGNS).join(",") || null }),
    setDateRangePreset: (preset: DatePreset) =>
      setParams({ range: preset, start: null, end: null }),
    setCustomDateRange: (start: string, end: string) =>
      setParams({ range: "custom", start, end }),
    setProductFilter: (values: string[]) => setParams({ product: values.join(",") || null }),
    setApproachFilter: (values: string[]) => setParams({ approach: values.join(",") || null }),
    setContentTypeFilter: (values: string[]) => setParams({ type: values.join(",") || null }),
    setPlatformFilter: (values: string[]) => setParams({ platform: values.join(",") || null }),
    setSearch: (q: string) => setParams({ q: q || null }),
    setSortBy: (sort: SortOption) => setParams({ sort }),
    setChartGranularity: (g: ChartGranularity) => setParams({ granularity: g }),
    setChartMetric: (m: ChartMetric) => setParams({ metric: m }),
    setViewMode: (v: ViewMode) => setParams({ view: v }),
    setClassificationDimension: (d: ClassificationDimension) => setParams({ dimension: d }),
    setSelectedContentId: (id: string | null) => setParams({ content: id }),
    clearFilters: () =>
      setParams({
        product: null,
        approach: null,
        type: null,
        platform: null,
        q: null,
        range: null,
        start: null,
        end: null,
        campaigns: null,
      }),
  };
}
