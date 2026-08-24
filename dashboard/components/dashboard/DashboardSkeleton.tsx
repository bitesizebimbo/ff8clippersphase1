import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between border-b border-border pb-5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-16 w-full rounded-[var(--radius-lg)]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-[var(--radius-lg)]" />
      <Skeleton className="h-64 w-full rounded-[var(--radius-lg)]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[9/16] rounded-[var(--radius-lg)]" />
        ))}
      </div>
    </div>
  );
}
