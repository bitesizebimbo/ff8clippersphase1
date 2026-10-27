"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contentWeek, formatWeekLabel } from "@/lib/analytics";
import type { ContentItem, SortOption, ViewMode } from "@/lib/types";
import { ContentCard } from "./ContentCard";
import { ContentTable } from "./ContentTable";
import { EmptyState } from "./EmptyState";

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: "views-desc", label: "Most Views" },
  { id: "engagements-desc", label: "Highest Engagements" },
  { id: "engagementRate-desc", label: "Highest Engagement Rate" },
  { id: "date-desc", label: "Newest" },
  { id: "date-asc", label: "Oldest" },
];

const PAGE_SIZE = { grid: 24, table: 50 };

export function ContentLibrary({
  items,
  totalUnfiltered,
  sortBy,
  viewMode,
  onSortChange,
  onViewModeChange,
  onSelect,
  onClearFilters,
}: {
  items: ContentItem[];
  totalUnfiltered: number;
  sortBy: SortOption;
  viewMode: ViewMode;
  onSortChange: (s: SortOption) => void;
  onViewModeChange: (v: ViewMode) => void;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
}) {
  // Week filter for the library only (KPIs and charts keep following the
  // filter bar). Weeks are the sheets' own reporting weeks, labelled like
  // the weekly chart ("WK41"), newest first. A week that no longer exists
  // in the current selection (e.g. after switching campaign) falls back to
  // "All weeks".
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const weekOptions = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of items) {
      const w = contentWeek(item);
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => b - a);
  }, [items]);
  const activeWeek =
    selectedWeek !== null && weekOptions.some(([w]) => w === selectedWeek) ? selectedWeek : null;
  const shownItems = useMemo(
    () => (activeWeek === null ? items : items.filter((item) => contentWeek(item) === activeWeek)),
    [items, activeWeek],
  );

  const resetKey = `${viewMode}:${shownItems.length}:${shownItems[0]?.id ?? ""}:${sortBy}`;
  const [visible, setVisible] = useState(PAGE_SIZE[viewMode]);
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  // Reset pagination during render when the filtered/sorted set changes,
  // rather than in an effect — avoids an extra render pass on every filter
  // change. See https://react.dev/learn/you-might-not-need-an-effect
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setVisible(PAGE_SIZE[viewMode]);
  }

  const visibleItems = shownItems.slice(0, visible);
  const hasMore = visible < shownItems.length;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Content Library
          </h2>
          <p className="text-sm text-foreground-muted">
            {shownItems.length === totalUnfiltered
              ? `${shownItems.length} pieces of content`
              : `${shownItems.length} of ${totalUnfiltered} pieces of content`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeWeek ?? ""}
            onChange={(e) => setSelectedWeek(e.target.value === "" ? null : Number(e.target.value))}
            aria-label="Filter by week"
            className="h-9 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 text-sm text-foreground"
          >
            <option value="">All weeks</option>
            {weekOptions.map(([week, count]) => (
              <option key={week} value={week}>
                {formatWeekLabel(week)} ({count})
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            aria-label="Sort content"
            className="h-9 rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 text-sm text-foreground"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex items-center rounded-[var(--radius-sm)] border border-border p-0.5">
            <Button
              variant={viewMode === "grid" ? "primary" : "ghost"}
              size="icon"
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              onClick={() => onViewModeChange("grid")}
              className="h-8 w-8"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant={viewMode === "table" ? "primary" : "ghost"}
              size="icon"
              aria-label="Table view"
              aria-pressed={viewMode === "table"}
              onClick={() => onViewModeChange("table")}
              className="h-8 w-8"
            >
              <Rows3 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {shownItems.length === 0 ? (
        <EmptyState
          title="No content matches these filters."
          description="Try changing your date range or removing one of the filters."
          onClear={onClearFilters}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleItems.map((item) => (
            <ContentCard key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <ContentTable items={visibleItems} onSelect={onSelect} />
      )}

      {hasMore && (
        <Button
          variant="secondary"
          onClick={() => setVisible((v) => v + PAGE_SIZE[viewMode])}
          className="mx-auto"
        >
          Load more ({shownItems.length - visible} remaining)
        </Button>
      )}
    </section>
  );
}
