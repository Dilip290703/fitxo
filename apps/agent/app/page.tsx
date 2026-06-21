"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@fitzo/supabase/client";
import { getAgentContext, type AgentContext, type AgentStatus } from "@/lib/agent-auth";
import {
  fetchMyDeliveries,
  riderSetAvailability,
  type DeliveryListItem,
} from "@/lib/deliveries";
import { StatusPill, isActiveDelivery } from "@/components/status";

export default function AgentDashboard() {
  const router = useRouter();
  const [status, setStatus] = useState<AgentStatus | "loading">("loading");
  const [ctx, setCtx] = useState<AgentContext | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryListItem[]>([]);
  const [available, setAvailable] = useState(false);

  const load = useCallback(async () => {
    const { status, context } = await getAgentContext();
    setStatus(status);
    setCtx(context);
    if (status === "no-session") {
      router.replace("/login");
      return;
    }
    if (status === "ok" && context) {
      setAvailable(context.isAvailable);
      setDeliveries(await fetchMyDeliveries(context.riderId));
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  async function toggleAvailable() {
    const next = !available;
    setAvailable(next);
    await riderSetAvailability(next);
  }

  if (status === "loading") {
    return <Centered>Loading…</Centered>;
  }

  if (status === "not-rider") {
    return (
      <GateScreen
        title="Not a rider account"
        body="This account isn't registered as a Fitzo delivery partner. If you just signed up, an admin needs to add you as a rider."
        onSignOut={signOut}
      />
    );
  }

  if (status === "unverified") {
    return (
      <GateScreen
        title="Verification pending"
        body="Your rider account is awaiting admin verification. You'll be able to take deliveries once you're approved."
        onSignOut={signOut}
      />
    );
  }

  const active = deliveries.filter((d) => isActiveDelivery(d.status));
  const past = deliveries.filter((d) => !isActiveDelivery(d.status));

  return (
    <main className="min-h-screen bg-[#0f1522] pb-16 text-white">
      <header className="sticky top-0 z-10 border-b border-[#1e293b] bg-[#0f1522]/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[640px] items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c8aa5]">Fitzo Partner</p>
            <p className="text-[16px] font-semibold">{ctx?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAvailable}
              className={[
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                available ? "bg-[#16322a] text-[#7fe0b0]" : "bg-[#2a2030] text-[#e0a87f]",
              ].join(" ")}
            >
              <span className={["h-2 w-2 rounded-full", available ? "bg-[#34d399]" : "bg-[#f59e0b]"].join(" ")} />
              {available ? "Online" : "Offline"}
            </button>
            <button onClick={signOut} className="text-[12px] text-[#7c8aa5] hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[640px] px-5 pt-6">
        <Section title={`Active deliveries (${active.length})`}>
          {active.length === 0 ? (
            <Empty text="No active deliveries. New jobs assigned to you will appear here." />
          ) : (
            active.map((d) => <DeliveryCard key={d.id} d={d} />)
          )}
        </Section>

        {past.length > 0 && (
          <Section title="Completed">
            {past.map((d) => <DeliveryCard key={d.id} d={d} />)}
          </Section>
        )}
      </div>
    </main>
  );
}

function DeliveryCard({ d }: { d: DeliveryListItem }) {
  const addr = d.drop_address;
  return (
    <Link
      href={`/deliveries/${d.id}`}
      className="block rounded-[16px] border border-[#22304a] bg-[#161e2e] p-4 transition hover:border-[#3b82f6]"
    >
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold">{d.order?.order_number ?? "Order"}</p>
        <StatusPill status={d.status} />
      </div>
      <p className="mt-1 text-[13px] text-[#9fb0cc]">
        {addr.line1 ? `${addr.line1}, ` : ""}
        {addr.city ?? "Address on file"} {addr.pincode ?? ""}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12px] text-[#7c8aa5]">
          {addr.full_name ? `For ${addr.full_name}` : "Customer"}
        </span>
        <span className="text-[13px] font-medium text-white">
          ₹{(d.order?.final_amount ?? 0).toLocaleString("en-IN")}
        </span>
      </div>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.15em] text-[#7c8aa5]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-[16px] border border-dashed border-[#22304a] p-6 text-center text-[13px] text-[#7c8aa5]">
      {text}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#0f1522] text-[#7c8aa5]">{children}</main>;
}

function GateScreen({ title, body, onSignOut }: { title: string; body: string; onSignOut: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f1522] px-5">
      <div className="max-w-[400px] rounded-[20px] border border-[#243049] bg-[#161e2e] p-7 text-center">
        <h1 className="text-[20px] font-semibold text-white">{title}</h1>
        <p className="mt-2 text-[14px] leading-6 text-[#9fb0cc]">{body}</p>
        <button onClick={onSignOut} className="mt-5 text-[13px] text-[#7c8aa5] hover:text-white">
          Sign out
        </button>
      </div>
    </main>
  );
}
