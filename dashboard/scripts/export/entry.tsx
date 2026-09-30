// Browser entry point for the standalone HTML export (scripts/export-html.mjs):
// renders the same DashboardShell as app/page.tsx, from data embedded in the
// page instead of loaded on the server.
import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import type { LoadedDashboardData } from "@/lib/load-content";

const data = JSON.parse(
  document.getElementById("dashboard-data")!.textContent!,
) as LoadedDashboardData;

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<DashboardSkeleton />}>
    <DashboardShell content={data.content} campaigns={data.campaigns} />
  </Suspense>,
);
