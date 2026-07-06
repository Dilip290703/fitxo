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
import { Banner, btnPrimary, inr } from "@/components/ui";
import { IconArrowLeft, IconMapPin, IconPhone } from "@/components/icons";

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
    <main className="min-h-screen bg-paper pb-32 text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[640px] items-center gap-3">
          <Link
            href="/"
            aria-label="Back to dashboard"
            className="grid h-11 w-11 -ml-2 place-items-center rounded-full text-soft hover:bg-cream hover:text-ink"
          >
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Delivery</p>
            <p className="font-mono text-[15px] font-semibold">{detail.order?.order_number}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[640px] space-y-5 px-5 pt-6">
        {/* Customer / address */}
        <Card>
          <Label>Deliver to</Label>
          <p className="text-[16px] font-semibold">{addr.full_name ?? "Customer"}</p>
          <p className="mt-1 text-[14px] leading-6 text-body">
            {[addr.line1, addr.line2, addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ") || "Address not on file (demo order)"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {addr.phone && (
              <a
                href={`tel:${addr.phone}`}
                className="flex h-11 items-center gap-2 rounded-xl bg-success-bg px-4 text-[14px] font-semibold text-success"
              >
                <IconPhone size={16} /> Call {addr.phone}
              </a>
            )}
            {(addr.line1 || addr.pincode) && (
              <a
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([addr.line1, addr.city, addr.pincode].filter(Boolean).join(" "))}`}
                className="flex h-11 items-center gap-2 rounded-xl bg-info-bg px-4 text-[14px] font-semibold text-info"
              >
                <IconMapPin size={16} /> Open in Maps
              </a>
            )}
          </div>
        </Card>

        {/* Live try window */}
        {windowActive && (
          <Card className="border-ink bg-ink">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-accent">
              Try-on window — customer is deciding
            </p>
            <p className={["mt-1 font-mono text-[52px] font-bold leading-none tabular-nums", timer.expired ? "text-danger" : "text-white"].join(" ")}>
              {timer.expired ? "00:00" : timer.label}
            </p>
            <p className="mt-2 text-[13px] text-white/70">
              {timer.expired ? "Time's up — collect any returns and complete." : "Wait at the door while the customer tries on and decides."}
            </p>
          </Card>
        )}

        {orderStatus === "delivered" && (
          <Card className="border-accent-soft bg-accent-pale">
            <p className="text-[14px] leading-6 text-warn">
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
              <li key={it.id} className="flex items-center gap-3 rounded-xl bg-cream p-3">
                {it.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image_url} alt={it.product_name} className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-sand" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{it.product_name}</p>
                  <p className="text-[12px] text-soft">{it.color_name} · {it.size} · {inr(it.price_at_order)}</p>
                </div>
                <DecisionTag decision={it.decision} live={windowActive} />
              </li>
            ))}
          </ul>

          {(windowActive || orderStatus === "completed") && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline pt-3 text-[13px] font-medium">
              <span className="text-success">Keeping {kept.length}</span>
              <span className="text-warn">Returning {returned.length}</span>
              {pending.length > 0 && <span className="text-soft">Undecided {pending.length}</span>}
              <span className="ml-auto text-ink">
                Collect: <strong>{returned.length + (timer.expired ? pending.length : 0)}</strong> item(s)
              </span>
            </div>
          )}
        </Card>

        {error && <Banner kind="err">{error}</Banner>}
      </div>

      {/* Sticky action bar — the status machine */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-4 backdrop-blur">
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
                className="flex h-11 w-full items-center justify-center rounded-xl border border-danger-line bg-white text-[14px] font-semibold text-danger transition hover:bg-danger-bg disabled:opacity-50"
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
            <button
              onClick={() => router.push("/")}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-success-line bg-success-bg text-[15px] font-semibold text-success"
            >
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
    <button onClick={onClick} disabled={busy || disabled} className={btnPrimary}>
      {busy ? "…" : children}
    </button>
  );
}

function DecisionTag({ decision, live }: { decision: "pending" | "keep" | "return"; live: boolean }) {
  if (decision === "keep") return <span className="rounded-full border border-success-line bg-success-bg px-2.5 py-1 text-[12px] font-semibold text-success">Keeping</span>;
  if (decision === "return") return <span className="rounded-full border border-warn-bg bg-warn-bg px-2.5 py-1 text-[12px] font-semibold text-warn">Return</span>;
  return <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-semibold text-soft">{live ? "Deciding…" : "—"}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={["rounded-2xl border border-line bg-white p-4", className].join(" ")}>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{children}</p>;
}
function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-paper text-soft">{children}</main>;
}
