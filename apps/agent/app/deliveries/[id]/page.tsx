"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@fitzo/supabase/client";
import {
  fetchDeliveryDetail,
  riderAccept,
  riderPickedUp,
  riderDelivered,
  riderComplete,
  riderRelease,
  type DeliveryDetail,
} from "@/lib/deliveries";

function useCountdown(deadline: string | null, active: boolean) {
  const [left, setLeft] = useState<number>(0);
  useEffect(() => {
    if (!deadline || !active) return;
    const tick = () => setLeft(Math.max(0, new Date(deadline).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, active]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { ms: left, label: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, expired: left <= 0 };
}

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orderIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetchDeliveryDetail(id);
    setDetail(d);
    orderIdRef.current = d?.order_id ?? null;
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refetch whenever the order / try-session / items change.
  useEffect(() => {
    if (!detail?.order_id) return;
    const supabase = createClient();
    const orderId = detail.order_id;
    const ch = supabase
      .channel(`delivery-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "try_sessions", filter: `order_id=eq.${orderId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `order_id=eq.${orderId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [detail?.order_id, load]);

  // Polling fallback: the rider's order RLS is a join-based policy that Realtime
  // row-filtering doesn't reliably match, so poll while the delivery is in flight
  // to guarantee the customer's decisions + the try-window timer show up here.
  useEffect(() => {
    if (!detail || detail.status === "completed" || detail.status === "failed") return;
    const id = setInterval(() => load(), 4000);
    return () => clearInterval(id);
  }, [detail, load]);

  async function run(fn: () => Promise<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) { setError(error.message); return; }
    await load();
  }

  // Hooks must run unconditionally — compute these before any early return.
  const orderStatus = detail?.order?.status;
  const windowActive = orderStatus === "try_window_active";
  const timer = useCountdown(detail?.trySession?.deadline_at ?? null, windowActive);

  if (loading) return <Centered>Loading…</Centered>;
  if (!detail) return <Centered>Delivery not found.</Centered>;

  const kept = detail.items.filter((i) => i.decision === "keep");
  const returned = detail.items.filter((i) => i.decision === "return");
  const pending = detail.items.filter((i) => i.decision === "pending");
  const allDecided = pending.length === 0;
  const addr = detail.drop_address;

  return (
    <main className="min-h-screen bg-[#0f1522] pb-28 text-white">
      <header className="sticky top-0 z-10 border-b border-[#1e293b] bg-[#0f1522]/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-[640px] items-center gap-3">
          <Link href="/" className="text-[#7c8aa5] hover:text-white">←</Link>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c8aa5]">Delivery</p>
            <p className="text-[15px] font-semibold">{detail.order?.order_number}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[640px] space-y-5 px-5 pt-6">
        {/* Customer / address */}
        <Card>
          <Label>Deliver to</Label>
          <p className="text-[15px] font-semibold">{addr.full_name ?? "Customer"}</p>
          <p className="mt-1 text-[13px] text-[#9fb0cc]">
            {[addr.line1, addr.line2, addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ") || "Address not on file (demo order)"}
          </p>
          <div className="mt-3 flex gap-2">
            {addr.phone && (
              <a href={`tel:${addr.phone}`} className="rounded-[10px] bg-[#1e2a45] px-3 py-2 text-[13px] font-medium text-[#9fc0ff]">
                Call {addr.phone}
              </a>
            )}
            {(addr.line1 || addr.pincode) && (
              <a
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([addr.line1, addr.city, addr.pincode].filter(Boolean).join(" "))}`}
                className="rounded-[10px] bg-[#1e2a45] px-3 py-2 text-[13px] font-medium text-[#9fc0ff]"
              >
                Open in Maps
              </a>
            )}
          </div>
        </Card>

        {/* Live try window */}
        {windowActive && (
          <Card className="border-[#3b82f6] bg-[#10203f]">
            <Label>Try-on window — customer is deciding</Label>
            <p className={["mt-1 font-mono text-[44px] font-bold leading-none tabular-nums", timer.expired ? "text-[#ff9b9b]" : "text-white"].join(" ")}>
              {timer.expired ? "00:00" : timer.label}
            </p>
            <p className="mt-2 text-[12px] text-[#9fb0cc]">
              {timer.expired ? "Time's up — collect any returns and complete." : "Wait while the customer tries on and decides."}
            </p>
          </Card>
        )}

        {orderStatus === "delivered" && (
          <Card className="border-[#f59e0b]/40 bg-[#241d10]">
            <p className="text-[13px] text-[#ffd27f]">
              Handed over. Waiting for the customer to tap <strong>Start try-on</strong> on their phone — the timer
              begins then (live here).
            </p>
          </Card>
        )}

        {/* Items + live decisions */}
        <Card>
          <Label>Items ({detail.items.length})</Label>
          <ul className="mt-2 space-y-2">
            {detail.items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 rounded-[12px] bg-[#0f1522] p-3">
                {it.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image_url} alt={it.product_name} className="h-12 w-12 rounded-[8px] object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-[8px] bg-[#1e2a45]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{it.product_name}</p>
                  <p className="text-[11px] text-[#7c8aa5]">{it.color_name} · {it.size} · ₹{it.price_at_order.toLocaleString("en-IN")}</p>
                </div>
                <DecisionTag decision={it.decision} live={windowActive} />
              </li>
            ))}
          </ul>

          {(windowActive || orderStatus === "completed") && (
            <div className="mt-3 flex gap-4 border-t border-[#22304a] pt-3 text-[12px]">
              <span className="text-[#7fe0b0]">Keeping {kept.length}</span>
              <span className="text-[#ffb27f]">Returning {returned.length}</span>
              {pending.length > 0 && <span className="text-[#7c8aa5]">Undecided {pending.length}</span>}
              <span className="ml-auto text-white">
                Collect: <strong>{returned.length + (timer.expired ? pending.length : 0)}</strong> item(s)
              </span>
            </div>
          )}
        </Card>

        {error && <p className="rounded-[10px] bg-[#3a1d1d] px-3 py-2 text-[13px] text-[#ff9b9b]">{error}</p>}
      </div>

      {/* Sticky action bar — the status machine */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[#1e293b] bg-[#0f1522]/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-[640px]">
          {detail.status === "assigned" && (
            <ActionButton busy={busy} onClick={() => run(() => riderAccept(id))}>Accept delivery</ActionButton>
          )}
          {detail.status === "accepted" && (
            <div className="space-y-2">
              <ActionButton busy={busy} onClick={() => run(() => riderPickedUp(id))}>Picked up from store</ActionButton>
              <button
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  const { error } = await riderRelease(id);
                  setBusy(false);
                  if (error) { setError(error.message); return; }
                  router.push("/"); // it's back in the pool; we no longer own it
                }}
                disabled={busy}
                className="w-full rounded-[12px] border border-[#3a2530] px-4 py-3 text-[13px] font-semibold text-[#e0a87f] transition hover:bg-[#2a2030] disabled:opacity-50"
              >
                Can't take it — return to pool
              </button>
            </div>
          )}
          {(detail.status === "picked_up" || detail.status === "en_route") && (
            <ActionButton busy={busy} onClick={() => run(() => riderDelivered(id))}>Mark delivered (at door)</ActionButton>
          )}
          {detail.status === "arrived" && orderStatus === "delivered" && (
            <ActionButton disabled busy={false} onClick={() => {}}>Waiting for customer to start…</ActionButton>
          )}
          {windowActive && (
            <ActionButton
              busy={busy}
              disabled={!timer.expired && !allDecided}
              onClick={() => run(() => riderComplete(id))}
            >
              {timer.expired || allDecided ? "Collect returns & complete" : "Waiting for customer to decide…"}
            </ActionButton>
          )}
          {(detail.status === "completed" || orderStatus === "completed") && (
            <button onClick={() => router.push("/")} className="w-full rounded-[12px] bg-[#16322a] px-4 py-3.5 text-[14px] font-semibold text-[#7fe0b0]">
              Delivery complete ✓ — back to dashboard
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function ActionButton({ children, onClick, busy, disabled }: { children: React.ReactNode; onClick: () => void; busy: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className="w-full rounded-[12px] bg-[#3b82f6] px-4 py-3.5 text-[14px] font-semibold text-white transition hover:bg-[#2f6fdc] disabled:cursor-not-allowed disabled:bg-[#243049] disabled:text-[#7c8aa5]"
    >
      {busy ? "…" : children}
    </button>
  );
}

function DecisionTag({ decision, live }: { decision: "pending" | "keep" | "return"; live: boolean }) {
  if (decision === "keep") return <span className="rounded-full bg-[#16322a] px-2.5 py-1 text-[11px] font-semibold text-[#7fe0b0]">Keeping</span>;
  if (decision === "return") return <span className="rounded-full bg-[#322a16] px-2.5 py-1 text-[11px] font-semibold text-[#ffd27f]">Return</span>;
  return <span className="rounded-full bg-[#1e2a45] px-2.5 py-1 text-[11px] font-semibold text-[#7c8aa5]">{live ? "Deciding…" : "—"}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={["rounded-[16px] border border-[#22304a] bg-[#161e2e] p-4", className].join(" ")}>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8aa5]">{children}</p>;
}
function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#0f1522] text-[#7c8aa5]">{children}</main>;
}
