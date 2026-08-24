import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  onClear,
  className,
}: {
  title: string;
  description: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border p-8 text-center ${className ?? ""}`}
    >
      <SearchX className="h-6 w-6 text-foreground-subtle" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-sm text-foreground-muted">{description}</p>
      {onClear && (
        <Button variant="secondary" size="sm" onClick={onClear} className="mt-2">
          Clear filters
        </Button>
      )}
    </div>
  );
}
