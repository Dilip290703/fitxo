"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";
import { useAgentGuard } from "@/lib/useAgentGuard";
import { riderSetAvailability } from "@/lib/deliveries";
import { JobAlertsProvider } from "@/components/alerts/JobAlertsProvider";
import type { AgentContext } from "@/lib/agent-auth";

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

type NavItem = { key: NavKey; label: string; icon: string; href: string };

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "◧", href: "/" },
  { key: "deliveries", label: "Deliveries", icon: "🛵", href: "/deliveries" },
  { key: "history", label: "History", icon: "🕘", href: "/history" },
  { key: "earnings", label: "Earnings", icon: "💰", href: "/earnings" },
  { key: "notifications", label: "Notifications", icon: "🔔", href: "/notifications" },
  { key: "profile", label: "Profile", icon: "👤", href: "/profile" },
  { key: "settings", label: "Settings", icon: "⚙", href: "/settings" },
  { key: "support", label: "Support", icon: "💬", href: "/support" },
  { key: "guide", label: "Guide", icon: "🧭", href: "/guide" },
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
        body="This account isn't registered as a Fitzo delivery partner. If you just signed up, an admin needs to add you as a rider before you can take deliveries."
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

  const sidebar = (
    <div className="flex h-full flex-col bg-[#131a28] text-white">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="font-serif text-[19px] font-semibold tracking-[0.18em]">FITZO</span>
        <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75">
          Rider
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
                isActive
                  ? "bg-[#3b82f6] text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="w-5 text-center text-[14px]">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <OnlineToggle available={available} onToggle={setAvailable} />
        <p className="mt-3 truncate text-[13px] font-semibold">{rider.name}</p>
        <p className="truncate text-[11px] text-white/45">{rider.email}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 h-9 w-full rounded-full border border-white/25 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85 transition hover:bg-white hover:text-[#131a28]"
        >
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <Ctx.Provider value={{ rider, available, setAvailable, signOut }}>
      {/* Live new-job + try-window pop-up alerts (verified riders only) */}
      <JobAlertsProvider />
      <div className="min-h-screen bg-[#0f1522] text-white lg:grid lg:grid-cols-[256px_1fr]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen border-r border-[#1e293b] lg:block">{sidebar}</aside>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#1e293b] bg-[#0f1522]/95 px-4 py-3 backdrop-blur lg:hidden">
          <span className="font-serif text-[16px] font-semibold tracking-[0.18em]">FITZO</span>
          <div className="flex items-center gap-2">
            <OnlineToggle available={available} onToggle={setAvailable} compact />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#243049] text-white"
            >
              ☰
            </button>
          </div>
        </header>

        {/* Mobile slide-over menu */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-0 h-full w-[280px]">{sidebar}</div>
          </div>
        )}

        {/* Main — extra bottom padding so the mobile tab bar never covers content */}
        <main className="min-w-0 pb-24 lg:pb-0">{children}</main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#1e293b] bg-[#0f1522]/95 backdrop-blur lg:hidden">
          {BOTTOM.map((key) => {
            const item = NAV.find((n) => n.key === key)!;
            const isActive = item.key === active;
            return (
              <Link
                key={key}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
                  isActive ? "text-[#3b82f6]" : "text-[#7c8aa5]"
                }`}
              >
                <span className="text-[17px] leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-[#7c8aa5]"
          >
            <span className="text-[17px] leading-none">⋯</span>
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
  compact = false,
}: {
  available: boolean;
  onToggle: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!available)}
      className={[
        "flex items-center gap-2 rounded-full font-semibold transition",
        compact ? "px-3 py-1.5 text-[11px]" : "w-full justify-center px-3 py-2 text-[12px]",
        available ? "bg-[#16322a] text-[#7fe0b0]" : "bg-[#2a2030] text-[#e0a87f]",
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", available ? "bg-[#34d399]" : "bg-[#f59e0b]"].join(" ")} />
      {available ? "Online" : "Offline"}
    </button>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f1522] text-[#7c8aa5]">
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
    <main className="flex min-h-screen items-center justify-center bg-[#0f1522] px-5">
      <div className="max-w-[400px] rounded-[20px] border border-[#243049] bg-[#161e2e] p-7 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#241d10] text-[26px]">
          ⏳
        </div>
        {name && <p className="mb-1 text-[12px] text-[#7c8aa5]">Hi {name},</p>}
        <h1 className="text-[20px] font-semibold text-white">{title}</h1>
        <p className="mt-2 text-[14px] leading-6 text-[#9fb0cc]">{body}</p>
        <button onClick={onSignOut} className="mt-5 text-[13px] text-[#7c8aa5] hover:text-white">
          Sign out
        </button>
      </div>
    </main>
  );
}
