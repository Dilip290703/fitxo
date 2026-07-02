"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";
import { useStorePanel } from "@/components/panel/PanelContext";
import { AlertBell, useOrderAlerts } from "@/components/alerts/OrderAlertsProvider";
import { Icon, type IconName } from "@/components/icons";

type NavItem = {
  label: string;
  icon: IconName;
  href: string;
  /** Show the pending-orders badge on this item. */
  ordersBadge?: boolean;
};

type NavSection = { label: string | null; items: NavItem[] };

// Grouped by job-to-be-done: daily operations first, money next, admin last.
const NAV: NavSection[] = [
  {
    label: null,
    items: [{ label: "Dashboard", icon: "dashboard", href: "/" }],
  },
  {
    label: "Operations",
    items: [
      { label: "Orders", icon: "orders", href: "/orders", ordersBadge: true },
      { label: "Returns", icon: "returns", href: "/returns" },
      { label: "Catalogue", icon: "catalogue", href: "/catalogue" },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Earnings", icon: "earnings", href: "/earnings" },
      { label: "Analytics", icon: "analytics", href: "/analytics" },
    ],
  },
  {
    label: "Store",
    items: [
      { label: "Settings", icon: "settings", href: "/settings" },
      { label: "Staff", icon: "staff", href: "/staff" },
      { label: "Support", icon: "support", href: "/support" },
      { label: "Guide", icon: "guide", href: "/guide" },
    ],
  },
];

const COLLAPSE_KEY = "fitzo-store-nav-collapsed";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function sectionTitle(pathname: string): string {
  for (const section of NAV) {
    const hit = section.items.find((i) => isActive(pathname, i.href));
    if (hit) return hit.label;
  }
  return "Store";
}

/**
 * The persistent panel chrome: sidebar (grouped nav, pending-orders badge,
 * collapsible), header (section title + alert bell), mobile slide-over.
 * Mounted once in the (panel) layout — navigation swaps only the content.
 */
export function StoreShell({ children }: { children: ReactNode }) {
  const { storeName, isActive: storeActive } = useStorePanel();
  const { pendingCount } = useOrderAlerts();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const badge = (n: number) => (
    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-ink">
      {n > 99 ? "99+" : n}
    </span>
  );

  const sidebar = (showLabels: boolean) => (
    <div className="flex h-full flex-col bg-ink text-white">
      {/* Brand + store identity */}
      <div className={`border-b border-white/10 py-4 ${showLabels ? "px-5" : "px-3"}`}>
        <div className={`flex items-center gap-2 ${showLabels ? "" : "justify-center"}`}>
          <span className="font-serif text-[17px] font-semibold tracking-[0.18em]">
            {showLabels ? "FITZO" : "F"}
          </span>
          {showLabels ? (
            <span className="rounded-full border border-white/25 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75">
              Store
            </span>
          ) : null}
        </div>
        {showLabels ? (
          <div className="mt-3 flex items-center gap-2">
            <p className="min-w-0 truncate text-[13px] font-semibold" title={storeName}>
              {storeName}
            </p>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${storeActive ? "bg-emerald-400" : "bg-white/30"}`}
              title={storeActive ? "Live" : "Inactive"}
            />
          </div>
        ) : null}
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-3 ${showLabels ? "px-3" : "px-2"}`}>
        {NAV.map((section) => (
          <div key={section.label ?? "top"} className="mb-1">
            {section.label && showLabels ? (
              <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                {section.label}
              </p>
            ) : section.label ? (
              <div className="mx-2 my-3 border-t border-white/10" />
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={showLabels ? undefined : item.label}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl py-2.5 text-[13px] font-medium transition ${
                      showLabels ? "px-3" : "justify-center px-0"
                    } ${
                      active
                        ? "bg-accent text-ink"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon name={item.icon} className="h-[17px] w-[17px]" />
                    {showLabels ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                    {item.ordersBadge && pendingCount > 0 && showLabels ? badge(pendingCount) : null}
                    {item.ordersBadge && pendingCount > 0 && !showLabels ? (
                      <span className="absolute ml-4 mt-[-14px] h-2 w-2 rounded-full bg-accent" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: collapse + logout */}
      <div className={`border-t border-white/10 py-3 ${showLabels ? "px-3" : "px-2"}`}>
        <button
          type="button"
          onClick={handleLogout}
          title="Log out"
          className={`flex w-full items-center gap-3 rounded-xl py-2.5 text-[13px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white ${
            showLabels ? "px-3" : "justify-center px-0"
          }`}
        >
          <Icon name="logout" className="h-[17px] w-[17px]" />
          {showLabels ? "Log out" : null}
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`mt-0.5 hidden w-full items-center gap-3 rounded-xl py-2.5 text-[13px] font-medium text-white/50 transition hover:bg-white/10 hover:text-white lg:flex ${
            showLabels ? "px-3" : "justify-center px-0"
          }`}
        >
          <Icon name="collapse" className={`h-[17px] w-[17px] transition ${collapsed ? "rotate-180" : ""}`} />
          {showLabels ? "Collapse" : null}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block ${
          collapsed ? "w-[68px]" : "w-[248px]"
        }`}
      >
        {sidebar(!collapsed)}
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[264px]">{sidebar(true)}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink lg:hidden"
          >
            <Icon name="menu" className="h-[17px] w-[17px]" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
            {sectionTitle(pathname)}
          </h1>
          {pendingCount > 0 ? (
            <Link
              href="/orders"
              className="hidden items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink transition hover:bg-accent/80 sm:inline-flex"
            >
              {pendingCount} to confirm
            </Link>
          ) : null}
          <AlertBell />
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
