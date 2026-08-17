"use client";

import { createContext, useContext, useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@fitxo/supabase/client";
import { useAgentGuard } from "@/lib/useAgentGuard";
import { riderSetAvailability } from "@/lib/deliveries";
import { JobAlertsProvider } from "@/components/alerts/JobAlertsProvider";
import { IncomingJobsProvider } from "@/components/alerts/IncomingJobsProvider";
import type { AgentContext } from "@/lib/agent-auth";
import {
  IconBook,
  IconClock,
  IconDots,
  IconGear,
  IconHome,
  IconHourglass,
  IconLifebuoy,
  IconLogout,
  IconBell,
  IconScooter,
  IconUser,
  IconWallet,
  IconX,
} from "@/components/icons";

// ── Context: rider info + live availability, shared by every screen ───────
type AgentShellContext = {
  rider: AgentContext;
  available: boolean;
  setAvailable: (v: boolean) => void;
  signOut: () => void;
};

const Ctx = createContext<AgentShellContext | null>(null);
export function useAgent(): AgentShellContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAgent must be used inside <AgentShell>");
  return v;
}

type NavKey =
  | "dashboard" | "deliveries" | "history" | "earnings"
  | "notifications" | "profile" | "settings" | "support" | "guide";

type NavItem = {
  key: NavKey;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  href: string;
};

const NAV: NavItem[] = [
  { key: "dashboard", label: "Home", icon: IconHome, href: "/" },
  { key: "deliveries", label: "Jobs", icon: IconScooter, href: "/deliveries" },
  { key: "earnings", label: "Earnings", icon: IconWallet, href: "/earnings" },
  { key: "notifications", label: "Alerts", icon: IconBell, href: "/notifications" },
  { key: "history", label: "History", icon: IconClock, href: "/history" },
  { key: "profile", label: "Profile", icon: IconUser, href: "/profile" },
  { key: "settings", label: "Settings", icon: IconGear, href: "/settings" },
  { key: "support", label: "Support", icon: IconLifebuoy, href: "/support" },
  { key: "guide", label: "Guide", icon: IconBook, href: "/guide" },
];

// Primary tabs surfaced in the mobile bottom bar; the rest live in "More".
const BOTTOM: NavKey[] = ["dashboard", "deliveries", "earnings", "notifications"];

export function AgentShell({ active, children }: { active: NavKey; children: ReactNode }) {
  const guard = useAgentGuard();
  const router = useRouter();
  const [available, setAvailableState] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (guard.context) setAvailableState(guard.context.isAvailable);
  }, [guard.context]);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
  };

  if (guard.state === "loading") return <Centered>Loading…</Centered>;

  if (guard.state === "not-rider") {
    return (
      <GateScreen
        title="Not a rider account"
        body="This account isn't registered as a Fitxo delivery partner. If you just signed up, an admin needs to add you as a rider before you can take deliveries."
        onSignOut={signOut}
      />
    );
  }

  if (guard.state === "unverified") {
    return (
      <GateScreen
        title="Verification pending"
        body="Your rider account is awaiting admin verification. You'll be able to go online and take deliveries as soon as you're approved."
        onSignOut={signOut}
        name={guard.context?.name}
      />
    );
  }

  const rider = guard.context;

  const setAvailable = async (v: boolean) => {
    setAvailableState(v);
    const { error } = await riderSetAvailability(v);
    if (error) setAvailableState(!v); // revert on failure
  };

  const menuItems = NAV.filter((n) => !BOTTOM.includes(n.key));

  const sidebar = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="font-serif text-[19px] font-semibold tracking-[0.18em] text-ink">FITXO</span>
        <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-soft">
          Rider
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const isActive = item.key === active;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition ${
                isActive ? "bg-ink text-white" : "text-body hover:bg-cream hover:text-ink"
              }`}
            >
              <Icon size={19} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-4 py-4">
        <OnlineToggle available={available} onToggle={setAvailable} full />
        <p className="mt-3 truncate text-[14px] font-semibold text-ink">{rider.name}</p>
        <p className="truncate text-[12px] text-soft">{rider.email}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line-strong text-[12px] font-semibold uppercase tracking-[0.14em] text-body transition hover:bg-ink hover:text-white"
        >
          <IconLogout size={15} /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <Ctx.Provider value={{ rider, available, setAvailable, signOut }}>
      {/* Live new-job + try-window pop-up alerts (verified riders only) */}
      <JobAlertsProvider userId={rider.userId} />
      {/* Driver-app incoming-order offers with repeating alert (while online) */}
      <IncomingJobsProvider />
      <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[256px_1fr]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen border-r border-line lg:block">{sidebar}</aside>

        {/* Mobile top bar — pr leaves room for the floating alerts bell */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-paper/95 pl-4 pr-[60px] backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <span className="font-serif text-[16px] font-semibold tracking-[0.18em] text-ink">FITXO</span>
            <span className="rounded-full border border-line-strong px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-soft">
              Rider
            </span>
          </div>
          <OnlineToggle available={available} onToggle={setAvailable} />
        </header>

        {/* Mobile slide-over menu — z above the offer overlay (z-70): an open
            menu is a deliberate act and must not be buried under offer cards. */}
        {menuOpen && (
          <div className="fixed inset-0 z-[80] lg:hidden">
            <div className="absolute inset-0 bg-ink/40" onClick={() => setMenuOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-pop">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">{rider.name}</p>
                  <p className="truncate text-[12px] text-soft">{rider.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="grid h-11 w-11 place-items-center rounded-full text-soft hover:bg-cream hover:text-ink"
                >
                  <IconX size={20} />
                </button>
              </div>
              <nav className="p-3">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.key === active;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium ${
                        isActive ? "bg-ink text-white" : "text-ink hover:bg-cream"
                      }`}
                    >
                      <Icon size={20} className={isActive ? "" : "text-soft"} />
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={signOut}
                  className="mt-1 flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-danger hover:bg-danger-bg"
                >
                  <IconLogout size={20} /> Log out
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Main — extra bottom padding so the mobile tab bar never covers content */}
        <main className="min-w-0 pb-28 lg:pb-0">{children}</main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {BOTTOM.map((key) => {
            const item = NAV.find((n) => n.key === key)!;
            const isActive = item.key === active;
            const Icon = item.icon;
            return (
              <Link
                key={key}
                href={item.href}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  isActive ? "text-ink" : "text-muted"
                }`}
              >
                <span
                  className={`grid h-7 w-12 place-items-center rounded-full ${
                    isActive ? "bg-accent-pale" : ""
                  }`}
                >
                  <Icon size={21} />
                </span>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted"
          >
            <span className="grid h-7 w-12 place-items-center rounded-full">
              <IconDots size={21} />
            </span>
            More
          </button>
        </nav>
      </div>
    </Ctx.Provider>
  );
}

function OnlineToggle({
  available,
  onToggle,
  full = false,
}: {
  available: boolean;
  onToggle: (v: boolean) => void;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!available)}
      aria-pressed={available}
      className={[
        "flex h-11 items-center justify-center gap-2 rounded-full border px-4 text-[13px] font-bold uppercase tracking-[0.08em] transition",
        full ? "w-full" : "",
        available
          ? "border-success-line bg-success-bg text-success"
          : "border-line-strong bg-warn-bg text-warn",
      ].join(" ")}
    >
      <span
        className={[
          "h-2.5 w-2.5 rounded-full",
          available ? "animate-pulse bg-success" : "bg-warn-accent",
        ].join(" ")}
      />
      {available ? "Online" : "Offline"}
    </button>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper text-soft">
      {children}
    </main>
  );
}

function GateScreen({
  title,
  body,
  onSignOut,
  name,
}: {
  title: string;
  body: string;
  onSignOut: () => void;
  name?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5">
      <div className="max-w-[400px] rounded-3xl border border-line bg-white p-7 text-center shadow-float">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent-pale text-warn">
          <IconHourglass size={26} />
        </div>
        {name && <p className="mb-1 text-[13px] text-soft">Hi {name},</p>}
        <h1 className="text-[20px] font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-[14px] leading-6 text-body">{body}</p>
        <button
          onClick={onSignOut}
          className="mt-5 h-11 rounded-full px-5 text-[14px] font-medium text-soft hover:bg-cream hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
