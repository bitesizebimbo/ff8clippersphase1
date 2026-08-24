import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "accent" | "positive" | "negative";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-muted text-foreground-muted",
    accent: "bg-accent-soft text-accent",
    positive: "bg-positive-soft text-positive",
    negative: "bg-negative-soft text-negative",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
