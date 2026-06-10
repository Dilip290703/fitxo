"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";

type NavItem = {
  key: string;
  label: string;
  icon: string;
  href?: string;
  ready?: boolean;
};

// The store panel's main sections. Only screens that are built link out; the
// rest render as "Soon" until their task ships.
const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "▣", href: "/", ready: true },
  { key: "catalogue", label: "Catalogue", icon: "🛍", href: "/catalogue", ready: true },
  { key: "orders", label: "Orders", icon: "🧾", href: "/orders", ready: true },
  { key: "returns", label: "Returns", icon: "↩", href: "/returns", ready: true },
  { key: "earnings", label: "Earnings", icon: "₹", href: "/earnings", ready: true },
  { key: "analytics", label: "Analytics", icon: "📊", href: "/analytics", ready: true },
  { key: "staff", label: "Staff", icon: "👥" },
  { key: "settings", label: "Settings", icon: "⚙" },
  { key: "support", label: "Support", icon: "💬" },
];

export function StoreShell({
  active,
  storeName,
  children,
}: {
  active: string;
  storeName: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-[#171d2b] text-white">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="font-serif text-[19px] font-semibold tracking-[0.18em]">
          FITZO
        </span>
        <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75">
          Store
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const isActive = item.key === active;
          const base =
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition";
          if (item.ready && item.href) {
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`${base} ${
                  isActive
                    ? "bg-[#ffd233] text-[#171d2b]"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="w-5 text-center text-[14px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          }
          return (
            <div
              key={item.key}
              className={`${base} cursor-default text-white/35`}
              title="Coming soon"
            >
              <span className="w-5 text-center text-[14px]">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">
                Soon
              </span>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-[13px] font-semibold">{storeName}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 h-9 w-full rounded-full border border-white/25 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85 transition hover:bg-white hover:text-[#171d2b]"
        >
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fbfaf7] lg:grid lg:grid-cols-[256px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-[#ece5da] bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-lg border border-[#ece5da] text-[#171d2b]"
        >
          ☰
        </button>
        <span className="font-serif text-[16px] font-semibold tracking-[0.18em] text-[#171d2b]">
          FITZO
        </span>
        <span className="w-9" />
      </header>

      {/* Mobile slide-over */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[264px]">{sidebar}</div>
        </div>
      ) : null}

      <main className="min-w-0">{children}</main>
    </div>
  );
}
