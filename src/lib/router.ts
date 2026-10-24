import { useSyncExternalStore } from "react";

export type Route = "dashboard" | "pos" | "products" | "orders" | "customers" | "reports" | "settings";

const ROUTES: Route[] = ["dashboard", "pos", "products", "orders", "customers", "reports", "settings"];

function read(): Route {
  const seg = window.location.pathname.replace(/^\/+/, "").split("/")[0] as Route;
  return ROUTES.includes(seg) ? seg : "dashboard";
}

const listeners = new Set<() => void>();
window.addEventListener("popstate", () => listeners.forEach((l) => l()));

export function navigate(to: Route, opts: { replace?: boolean; query?: string } = {}) {
  const url = `/${to}${opts.query ? `?${opts.query}` : ""}`;
  if (opts.replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  listeners.forEach((l) => l());
  window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    read,
  );
}

export function queryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}
