"use client";

import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/formatters";
import type { DatePreset, DateRange } from "@/lib/types";
import type { DatasetBounds } from "@/lib/filters";

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "last7", label: "Last 7 Days" },
  { id: "last30", label: "Last 30 Days" },
  { id: "last90", label: "Last 90 Days" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "all", label: "All Time" },
];

export function DateRangePicker({
  preset,
  range,
  bounds,
  onPresetChange,
  onCustomChange,
}: {
  preset: DatePreset;
  range: DateRange;
  bounds: DatasetBounds;
  onPresetChange: (preset: DatePreset) => void;
  onCustomChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(range.start);
  const [draftEnd, setDraftEnd] = useState(range.end);

  const activeLabel =
    preset === "custom"
      ? `${formatShortDate(range.start)} – ${formatShortDate(range.end)}`
      : preset === "all"
        ? "All Time"
        : PRESETS.find((p) => p.id === preset)?.label;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraftStart(range.start);
          setDraftEnd(range.end);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-sm font-medium text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-surface-muted"
        >
          <Calendar className="h-3.5 w-3.5 text-foreground-subtle" aria-hidden />
          {activeLabel}
          <ChevronDown className="h-3.5 w-3.5 text-foreground-subtle" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              onPresetChange(p.id);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-sm hover:bg-surface-muted",
              preset === p.id && "bg-accent-soft text-accent",
            )}
          >
            {p.label}
          </button>
        ))}
        <div className="my-1 h-px bg-border" />
        <div className="px-2.5 py-1.5">
          <p className="mb-1.5 text-xs font-medium text-foreground-subtle">Custom Range</p>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={draftStart}
              min={bounds.minDate}
              max={draftEnd}
              onChange={(e) => setDraftStart(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border bg-surface px-2 text-xs text-foreground"
              aria-label="Start date"
            />
            <span className="text-foreground-subtle">→</span>
            <input
              type="date"
              value={draftEnd}
              min={draftStart}
              max={bounds.maxDate}
              onChange={(e) => setDraftEnd(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border bg-surface px-2 text-xs text-foreground"
              aria-label="End date"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onCustomChange(draftStart, draftEnd);
              setOpen(false);
            }}
            className="mt-2 h-8 w-full rounded-[var(--radius-sm)] bg-accent text-xs font-medium text-accent-foreground hover:bg-accent/90"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
