import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatExactNumber } from "@/lib/formatters";

export function KPICard({
  label,
  value,
  exactValue,
  delta,
  deltaLabel,
  icon: Icon,
  emphasis = "secondary",
  className,
}: {
  label: string;
  value: string;
  exactValue?: number;
  delta?: number | null;
  deltaLabel?: string;
  icon?: LucideIcon;
  emphasis?: "primary" | "secondary";
  className?: string;
}) {
  const trend = delta === undefined || delta === null || !Number.isFinite(delta)
    ? null
    : delta > 0.05
      ? "up"
      : delta < -0.05
        ? "down"
        : "flat";

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]",
        emphasis === "primary" ? "gap-3 p-5" : "gap-2",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "font-medium uppercase tracking-wide text-foreground-subtle",
            emphasis === "primary" ? "text-xs" : "text-[11px]",
          )}
        >
          {label}
        </span>
        {Icon && (
          <Icon
            className={cn(
              "text-foreground-subtle",
              emphasis === "primary" ? "h-4 w-4" : "h-3.5 w-3.5",
            )}
            aria-hidden
          />
        )}
      </div>
      <span
        title={exactValue !== undefined ? formatExactNumber(exactValue) : undefined}
        className={cn(
          "font-semibold tabular-nums tracking-tight text-foreground",
          emphasis === "primary" ? "text-[32px] leading-none" : "text-xl leading-none",
        )}
      >
        {value}
      </span>
      {trend && deltaLabel && (
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium",
            trend === "up" && "bg-positive-soft text-positive",
            trend === "down" && "bg-negative-soft text-negative",
            trend === "flat" && "bg-surface-muted text-foreground-muted",
          )}
        >
          {trend === "up" && <ArrowUp className="h-3 w-3" aria-hidden />}
          {trend === "down" && <ArrowDown className="h-3 w-3" aria-hidden />}
          {trend === "flat" && <Minus className="h-3 w-3" aria-hidden />}
          {deltaLabel}
          <span className="sr-only">
            {trend === "up" ? "increase" : trend === "down" ? "decrease" : "no change"} vs previous period
          </span>
        </span>
      )}
    </div>
  );
}
