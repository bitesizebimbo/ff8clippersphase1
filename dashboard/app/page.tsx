import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { loadAllContent } from "@/lib/load-content";

// Re-fetch live (Google Sheet-backed) campaigns at most every 5 minutes,
// rather than on every request.
export const revalidate = 300;

export default async function Home() {
  const { content, campaigns } = await loadAllContent();

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardShell content={content} campaigns={campaigns} />
    </Suspense>
  );
}
