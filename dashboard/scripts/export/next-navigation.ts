// Stand-in for next/navigation in the standalone HTML export, where there's
// no Next router. Dashboard state lives in URL search params (see
// lib/use-dashboard-state.ts); here those params live in the URL hash
// instead, since a file:// page can't rewrite its own query string.
import { useSyncExternalStore } from "react";

let params = new URLSearchParams(window.location.hash.slice(1));
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function navigate(href: string) {
  const query = href.split("?")[1] ?? "";
  params = new URLSearchParams(query);
  try {
    history.replaceState(null, "", query ? `#${query}` : " ");
  } catch {
    // Some viewers block history changes; the view still updates.
  }
  listeners.forEach((l) => l());
}

const router = {
  push: navigate,
  replace: navigate,
  back: () => history.back(),
  forward: () => history.forward(),
  refresh: () => {},
  prefetch: () => {},
};

export function useSearchParams() {
  return useSyncExternalStore(subscribe, () => params);
}

export function usePathname() {
  return "/";
}

export function useRouter() {
  return router;
}
