import { formatDate } from "@/lib/formatters";

export function DashboardHeader({
  dataAsOf,
  children,
}: {
  dataAsOf: string;
  children: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
          Samsung Galaxy Z Fold8 / Z Flip8 · FF8 Clippers Phase 1
        </p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">
          Content Performance
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Understand how your seeded content is performing.
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <p className="text-xs text-foreground-subtle">Data through {formatDate(dataAsOf)}</p>
        {children}
      </div>
    </header>
  );
}
