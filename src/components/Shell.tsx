import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import { navigate, useRoute, type Route } from "../lib/router";
import { supabase } from "../lib/supabase";
import { useProfile } from "../lib/api";
import { cx, Modal } from "./ui";
import { Logo } from "./Logo";

const NAV: { to: Route; label: string; icon: typeof Boxes }[] = [
  { to: "dashboard", label: "סקירה", icon: LayoutDashboard },
  { to: "pos", label: "קופה", icon: ShoppingCart },
  { to: "products", label: "מלאי", icon: Boxes },
  { to: "orders", label: "הזמנות", icon: ReceiptText },
  { to: "customers", label: "לקוחות", icon: Users },
  { to: "reports", label: "דוחות", icon: BarChart3 },
  { to: "settings", label: "הגדרות", icon: Settings },
];

const MOBILE_MAIN: Route[] = ["dashboard", "pos", "products", "orders"];

export function Shell({ children, cartCount }: { children: ReactNode; cartCount: number }) {
  const route = useRoute();
  const { data: profile } = useProfile();
  const [more, setMore] = useState(false);
  const name = profile?.business_name || "העסק שלי";

  const go = (to: Route) => {
    setMore(false);
    navigate(to);
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar (right side in RTL) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-line bg-surface lg:flex">
        <div className="flex items-center gap-3 px-5 pb-4 pt-5">
          <BusinessMark logo={profile?.logo_url} />
          <div className="min-w-0">
            <div className="truncate font-bold">{name}</div>
            <div className="text-xs text-muted">SmartStock</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="ניווט ראשי">
          {NAV.map((n) => {
            const active = route === n.to;
            return (
              <a
                key={n.to}
                href={`/${n.to}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(n.to);
                }}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium transition-colors",
                  active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <n.icon className="size-5" aria-hidden />
                <span className="flex-1">{n.label}</span>
                {n.to === "pos" && cartCount > 0 && (
                  <span className="num rounded-md bg-tag px-1.5 text-xs font-bold text-tag-ink">{cartCount}</span>
                )}
              </a>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] text-muted hover:bg-surface-2 hover:text-ink"
          >
            <LogOut className="size-5" aria-hidden />
            יציאה
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <BusinessMark logo={profile?.logo_url} small />
        <div className="min-w-0 flex-1 truncate font-bold">{name}</div>
      </header>

      <main className="min-w-0 px-4 pb-28 pt-4 lg:px-8 lg:pb-10 lg:pt-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
        aria-label="ניווט ראשי"
      >
        <div className="grid grid-cols-5">
          {MOBILE_MAIN.map((to) => {
            const n = NAV.find((x) => x.to === to)!;
            const active = route === to;
            return (
              <button
                key={to}
                type="button"
                onClick={() => go(to)}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-brand" : "text-muted")}
              >
                <span className={cx("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-brand-soft")}>
                  <n.icon className="size-[22px]" aria-hidden />
                </span>
                {n.label}
                {to === "pos" && cartCount > 0 && (
                  <span className="num absolute top-1.5 start-[calc(50%+6px)] min-w-5 rounded-md bg-tag px-1 text-[11px] font-bold leading-5 text-tag-ink">
                    {cartCount}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setMore(true)}
            className={cx(
              "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
              ["customers", "reports", "settings"].includes(route) ? "text-brand" : "text-muted",
            )}
          >
            <span className="flex h-7 w-12 items-center justify-center">
              <Menu className="size-[22px]" aria-hidden />
            </span>
            עוד
          </button>
        </div>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title="עוד">
        <div className="grid gap-1">
          {NAV.filter((n) => !MOBILE_MAIN.includes(n.to)).map((n) => (
            <button
              key={n.to}
              type="button"
              onClick={() => go(n.to)}
              className={cx(
                "flex h-13 items-center gap-3 rounded-[12px] px-3 text-base font-medium",
                route === n.to ? "bg-brand-soft text-brand" : "hover:bg-surface-2",
              )}
            >
              <n.icon className="size-5" aria-hidden /> {n.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="mt-2 flex h-13 items-center gap-3 rounded-[12px] border-t border-line px-3 text-base text-muted hover:bg-surface-2"
          >
            <LogOut className="size-5" aria-hidden /> יציאה מהחשבון
          </button>
        </div>
      </Modal>
    </div>
  );
}

function BusinessMark({ logo, small }: { logo?: string | null; small?: boolean }) {
  const size = small ? "size-8" : "size-10";
  if (logo && /^(https?:|data:image)/.test(logo)) {
    return <img src={logo} alt="" className={cx(size, "shrink-0 rounded-[9px] border border-line bg-white object-contain p-0.5")} />;
  }
  return <Logo className={cx(size, "shrink-0")} />;
}
