"use client";

import { Search, X } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import type { FilterOptions } from "@/lib/data";
import type { DashboardFilters } from "@/lib/types";

export function FilterBar({
  options,
  filters,
  hasActiveFilters,
  onProductChange,
  onApproachChange,
  onContentTypeChange,
  onPlatformChange,
  onSearchChange,
  onClear,
}: {
  options: FilterOptions;
  filters: DashboardFilters;
  hasActiveFilters: boolean;
  onProductChange: (v: string[]) => void;
  onApproachChange: (v: string[]) => void;
  onContentTypeChange: (v: string[]) => void;
  onPlatformChange: (v: string[]) => void;
  onSearchChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="scrollbar-thin flex items-end gap-3 overflow-x-auto pb-1 sm:pb-0">
        <MultiSelect
          label="Product"
          options={options.product}
          selected={filters.product}
          onChange={onProductChange}
        />
        <MultiSelect
          label="Approach"
          options={options.approach}
          selected={filters.approach}
          onChange={onApproachChange}
        />
        <MultiSelect
          label="Content Type"
          options={options.contentType}
          selected={filters.contentType}
          onChange={onContentTypeChange}
        />
        <MultiSelect
          label="Platform"
          options={options.platform}
          selected={filters.platform}
          onChange={onPlatformChange}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="mb-0.5 shrink-0">
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear filters
          </Button>
        )}
      </div>
      <label className="relative flex w-full items-center sm:w-64">
        <Search
          className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-foreground-subtle"
          aria-hidden
        />
        <span className="sr-only">Search content</span>
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search content..."
          className="h-9 w-full rounded-[var(--radius-sm)] border border-border bg-surface pl-8 pr-3 text-sm text-foreground placeholder:text-foreground-subtle"
        />
      </label>
    </div>
  );
}
