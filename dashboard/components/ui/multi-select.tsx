"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: MultiSelectProps) {
  const allSelected = selected.length === 0;

  function toggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((o) => o !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  const summary = allSelected
    ? "All"
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <span className="whitespace-nowrap text-xs font-medium text-foreground-subtle">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-9 min-w-[132px] items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-3 text-sm transition-colors",
              allSelected
                ? "border-border bg-surface text-foreground-muted hover:bg-surface-muted"
                : "border-accent/30 bg-accent-soft text-accent",
            )}
          >
            <span className="truncate">{summary}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent role="listbox" aria-label={label} className="p-1.5">
          <button
            type="button"
            role="option"
            aria-selected={allSelected}
            onClick={() => onChange([])}
            className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-sm hover:bg-surface-muted"
          >
            All
            {allSelected && <Check className="h-3.5 w-3.5 text-accent" aria-hidden />}
          </button>
          <div className="my-1 h-px bg-border" />
          <div className="max-h-64 overflow-y-auto">
            {options.map((option) => {
              const active = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => toggle(option)}
                  className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-sm hover:bg-surface-muted"
                >
                  <span className="truncate">{option}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
