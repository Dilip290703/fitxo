"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@fitzo/supabase/client";
import {
  fetchDeliveryDetail,
  fileDeliveryIssue,
  riderAccept,
  riderArrived,
  riderComplete,
  riderDelivered,
  riderFail,
  riderPickedUp,
  riderRelease,
  type DeliveryDetail,
  type DeliveryItem,
} from "@/lib/deliveries";
import { Banner, btnPrimary, inr } from "@/components/ui";
import {
  IconArrowLeft,
  IconCheck,
  IconLifebuoy,
  IconMapPin,
  IconPackage,
  IconPhone,
  IconX,
} from "@/components/icons";

const SUPPORT_PHONE = "+918000000000"; // rider helpline (matches /support)

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

/** Keep the screen awake during an active delivery — the rider's phone must not
 *  sleep mid try-window (audit B12). Best-effort: unsupported browsers no-op. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wl = (navigator as any).wakeLock;
    if (!wl?.request) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sentinel: any = null;
    let stopped = false;
    const acquire = async () => {
      try {
        sentinel = await wl.request("screen");
      } catch {
        /* denied (low battery etc.) — fine */
      }
    };
    const onVisible = () => {
      if (!stopped && document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release?.().catch(() => {});
    };
  }, [active]);
}

type ProblemMode = "menu" | "report" | "fail";

const REPORT_PRESETS = [
  "Store delayed / order not ready",
  "Wrong or missing item",
  "Item damaged",
  "Address hard to find",
  "Other",
];

const FAIL_PRESETS = [
  "Customer unreachable at the door",
  "Customer refused the delivery",
  "Wrong address — can't locate customer",
  "Safety concern at the location",
  "Other",
];

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [problem, setProblem] = useState<ProblemMode | null>(null);
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
  const isActive = !!detail && detail.status !== "completed" && detail.status !== "failed";
  const orderStatus = detail?.order?.status;
  const windowActive = orderStatus === "try_window_active";
  const timer = useCountdown(detail?.trySession?.deadline_at ?? null, windowActive);
  useWakeLock(isActive);

  if (loading) return <Centered>Loading…</Centered>;
  if (!detail) return <Centered>Delivery not found.</Centered>;

  const kept = detail.items.filter((i) => i.decision === "keep");
  const returned = detail.items.filter((i) => i.decision === "return");
  const pending = detail.items.filter((i) => i.decision === "pending");
  const allDecided = pending.length === 0;
  const addr = detail.drop_address;
  const pickup = detail.pickup_address;

  const beforePickup = detail.status === "assigned" || detail.status === "accepted";
  const enRoute = detail.status === "picked_up" || detail.status === "en_route";
  const atDoorAwaitingHandover = detail.status === "arrived" && orderStatus === "out_for_delivery";
  // finalize_order_if_decided (019) completed the order on the customer's last
  // decision, but the rider still has to collect the returns and close out the
  // DELIVERY (migration 035) — the delivery, not the order, is his job.
  const awaitingCollect = detail.status === "arrived" && orderStatus === "completed";

  // Everything the rider must physically take back before completing.
  const collectables: DeliveryItem[] = windowActive
    ? [...returned, ...(timer.expired ? pending : [])]
    : awaitingCollect
    ? returned
    : [];
  const allCollected = collectables.every((i) => collected.has(i.id));

  const canProblemFail = enRoute || detail.status === "arrived";

  return (
    <main className="min-h-screen bg-paper pb-36 text-ink">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[640px] items-center gap-3">
          <Link
            href="/"
            aria-label="Back to dashboard"
            className="grid h-11 w-11 -ml-2 place-items-center rounded-full text-soft hover:bg-cream hover:text-ink"
          >
            <IconArrowLeft size={20} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Delivery</p>
            <p className="font-mono text-[15px] font-semibold">{detail.order?.order_number}</p>
          </div>
          {isActive && (
            <button
              type="button"
              onClick={() => { setProblem("menu"); setNotice(null); }}
              className="flex h-11 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3.5 text-[13px] font-semibold text-body hover:bg-cream"
            >
              <IconLifebuoy size={15} /> Problem?
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[640px] space-y-5 px-5 pt-6">
        {/* Pickup — where to collect, front and center until picked up */}
        {beforePickup && (
          <Card className={detail.status === "accepted" ? "border-line-strong" : ""}>
            <Label>Pick up from</Label>
            {pickup.store_name ? (
              <>
                <p className="text-[16px] font-semibold">
                  {pickup.store_name}
                  {(pickup.store_count ?? 1) > 1 && (
                    <span className="ml-2 rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-semibold text-warn">
                      +{(pickup.store_count ?? 1) - 1} more store{(pickup.store_count ?? 1) > 2 ? "s" : ""}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[14px] leading-6 text-body">
                  {[pickup.address, pickup.city, pickup.pincode].filter(Boolean).join(", ") || "Address with the store"}
                </p>
                {(pickup.store_count ?? 1) > 1 && (
                  <p className="mt-1 text-[12px] text-warn">
                    This order has items from more than one store — check items below and call support if a pickup is unclear.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {pickup.phone && (
                    <a href={`tel:${pickup.phone}`} className="flex h-11 items-center gap-2 rounded-xl bg-success-bg px-4 text-[14px] font-semibold text-success">
                      <IconPhone size={16} /> Call store
                    </a>
                  )}
                  {(pickup.address || pickup.pincode) && (
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([pickup.store_name, pickup.address, pickup.city, pickup.pincode].filter(Boolean).join(" "))}`}
                      className="flex h-11 items-center gap-2 rounded-xl bg-info-bg px-4 text-[14px] font-semibold text-info"
                    >
                      <IconMapPin size={16} /> Store on Maps
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[14px] leading-6 text-body">
                Store details missing on this job (created before migration 033) — check the items below and call support if you're unsure where to collect.
              </p>
            )}
          </Card>
        )}

        {/* Customer / drop address */}
        <Card>
          <Label>Deliver to</Label>
          <p className="text-[16px] font-semibold">{addr.full_name ?? "Customer"}</p>
          <p className="mt-1 text-[14px] leading-6 text-body">
            {[addr.line1, addr.line2, addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ") || "Address not on file (demo order)"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {addr.phone && (
              <a href={`tel:${addr.phone}`} className="flex h-11 items-center gap-2 rounded-xl bg-success-bg px-4 text-[14px] font-semibold text-success">
                <IconPhone size={16} /> Call {addr.full_name?.split(" ")[0] ?? "customer"}
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

        {/* Handover — enter the customer's code */}
        {atDoorAwaitingHandover && (
          <Card className="border-ink">
            <Label>Handover code</Label>
            <p className="text-[14px] leading-6 text-body">
              Ask the customer for the <strong className="text-ink">4-digit code</strong> on their
              order-tracking page, then confirm the handover below.
            </p>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="• • • •"
              className="mt-3 h-14 w-full rounded-xl border border-line-strong bg-white text-center font-mono text-[28px] font-bold tracking-[0.5em] text-ink outline-none placeholder:text-faint focus:border-ink"
            />
            <p className="mt-2 text-[12px] text-soft">
              Older orders without a code: leave blank and confirm.
            </p>
          </Card>
        )}

        {/* Live try window — the rider's waiting room. Plain div, not <Card>:
            Card's own bg-white ties with bg-ink (equal Tailwind specificity,
            stylesheet order decides) and can leave white text invisible. */}
        {windowActive && (
          <div className="rounded-2xl bg-ink p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-accent">
              Try-on window — customer is deciding
            </p>
            <p className={["mt-1 font-mono text-[52px] font-bold leading-none tabular-nums", timer.expired ? "text-danger" : "text-white"].join(" ")}>
              {timer.expired ? "00:00" : timer.label}
            </p>
            <p className="mt-2 text-[13px] text-white/70">
              {timer.expired
                ? "Time's up — collect the items below and complete."
                : "Wait at the door. Decisions appear live below as the customer makes them."}
            </p>
            {addr.phone && !timer.expired && (
              <a
                href={`tel:${addr.phone}`}
                className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-white/10 text-[14px] font-semibold text-white"
              >
                <IconPhone size={16} /> Call customer
              </a>
            )}
          </div>
        )}

        {orderStatus === "delivered" && (
          <Card className="border-accent-soft bg-accent-pale">
            <p className="text-[14px] leading-6 text-warn">
              Handed over. Waiting for the customer to tap <strong>Start try-on</strong> on their phone — the timer
              begins then (live here). Not starting? Ask them to open their order-tracking page.
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
            </div>
          )}
        </Card>

        {/* Collect-returns checklist — tick each item you physically take back */}
        {((windowActive && (timer.expired || allDecided)) || awaitingCollect) && collectables.length > 0 && (
          <Card className="border-warn-accent/40">
            <Label>Collect before you leave ({collectables.length})</Label>
            <p className="mb-2 text-[13px] text-body">Tick each item as the customer hands it back.</p>
            <ul className="space-y-2">
              {collectables.map((it) => {
                const done = collected.has(it.id);
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setCollected((prev) => {
                          const next = new Set(prev);
                          if (next.has(it.id)) next.delete(it.id);
                          else next.add(it.id);
                          return next;
                        })
                      }
                      className={[
                        "flex min-h-[52px] w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                        done ? "border-success-line bg-success-bg" : "border-line bg-white",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                          done ? "border-success bg-success text-white" : "border-line-strong bg-white text-transparent",
                        ].join(" ")}
                      >
                        <IconCheck size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={["block truncate text-[14px] font-medium", done ? "text-success" : "text-ink"].join(" ")}>
                          {it.product_name}
                        </span>
                        <span className="block text-[12px] text-soft">{it.color_name} · {it.size}</span>
                      </span>
                      <IconPackage size={16} className={done ? "text-success" : "text-muted"} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {notice && <Banner kind="ok">{notice}</Banner>}
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
          {enRoute && (
            <ActionButton
              busy={busy}
              onClick={() =>
                run(async () => {
                  const res = await riderArrived(id);
                  // Pre-033 fallback: no arrival RPC yet → the old direct
                  // "delivered" call still moves the flow forward.
                  if (res.error?.code === "PGRST202") return riderDelivered(id, "");
                  return res;
                })
              }
            >
              I've arrived at the door
            </ActionButton>
          )}
          {atDoorAwaitingHandover && (
            <ActionButton busy={busy} onClick={() => run(() => riderDelivered(id, otp))}>
              Confirm handover{otp ? ` · ${otp}` : ""}
            </ActionButton>
          )}
          {detail.status === "arrived" && orderStatus === "delivered" && (
            <ActionButton disabled busy={false} onClick={() => {}}>Waiting for customer to start…</ActionButton>
          )}
          {windowActive && (
            <ActionButton
              busy={busy}
              disabled={(!timer.expired && !allDecided) || !allCollected}
              onClick={() => run(() => riderComplete(id))}
            >
              {!timer.expired && !allDecided
                ? "Waiting for customer to decide…"
                : !allCollected
                ? `Tick off ${collectables.length} item${collectables.length === 1 ? "" : "s"} to collect`
                : "Collect returns & complete"}
            </ActionButton>
          )}
          {awaitingCollect && (
            <ActionButton
              busy={busy}
              disabled={!allCollected}
              onClick={() => run(() => riderComplete(id))}
            >
              {!allCollected
                ? `Tick off ${collectables.length} item${collectables.length === 1 ? "" : "s"} to collect`
                : collectables.length > 0
                ? "Collect returns & complete"
                : "All kept — complete delivery"}
            </ActionButton>
          )}
          {detail.status === "completed" && (
            <button
              onClick={() => router.push("/")}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-success-line bg-success-bg text-[15px] font-semibold text-success"
            >
              Delivery complete ✓ — back to dashboard
            </button>
          )}
          {detail.status === "failed" && (
            <button
              onClick={() => router.push("/")}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-danger-line bg-danger-bg text-[15px] font-semibold text-danger"
            >
              Delivery failed — reported to Fitzo. Back to dashboard
            </button>
          )}
        </div>
      </div>

      {problem && (
        <ProblemSheet
          mode={problem}
          setMode={setProblem}
          canFail={canProblemFail}
          customerPhone={addr.phone ?? null}
          onClose={() => setProblem(null)}
          onReported={() => {
            setProblem(null);
            setNotice("Issue reported — Fitzo support can see it now. Carry on when you can.");
          }}
          detail={detail}
          onFailed={() => load()}
        />
      )}
    </main>
  );
}

// ── Problem bottom sheet: report an issue / can't deliver ─────────────────

function ProblemSheet({
  mode,
  setMode,
  canFail,
  customerPhone,
  onClose,
  onReported,
  onFailed,
  detail,
}: {
  mode: ProblemMode;
  setMode: (m: ProblemMode) => void;
  canFail: boolean;
  customerPhone: string | null;
  onClose: () => void;
  onReported: () => void;
  onFailed: () => void;
  detail: DeliveryDetail;
}) {
  const [preset, setPreset] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reason = [preset && preset !== "Other" ? preset : null, note.trim() || null]
    .filter(Boolean)
    .join(" — ");

  async function submitReport() {
    if (!reason) { setErr("Pick a reason or write a note."); return; }
    setSending(true);
    setErr(null);
    const { data: userData } = await createClient().auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) { setErr("Session expired — sign in again."); setSending(false); return; }
    const { error } = await fileDeliveryIssue({
      userId,
      orderId: detail.order_id,
      orderNumber: detail.order?.order_number ?? "order",
      subject: preset && preset !== "Other" ? preset : "Delivery problem",
      message: reason,
    });
    setSending(false);
    if (error) { setErr(error.message); return; }
    onReported();
  }

  async function submitFail() {
    if (!reason || reason.length < 5) { setErr("Pick a reason (add a note if it's 'Other')."); return; }
    setSending(true);
    setErr(null);
    const { error } = await riderFail(detail.id, reason);
    setSending(false);
    if (error) { setErr(error.message); return; }
    onFailed();
    onClose();
  }

  const presets = mode === "fail" ? FAIL_PRESETS : REPORT_PRESETS;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white pb-[max(env(safe-area-inset-bottom),16px)] shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="text-[16px] font-semibold text-ink">
            {mode === "menu" && "Having a problem?"}
            {mode === "report" && "Report an issue"}
            {mode === "fail" && "Can't complete this delivery"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-full text-soft hover:bg-cream hover:text-ink"
          >
            <IconX size={20} />
          </button>
        </div>

        {mode === "menu" && (
          <div className="space-y-2 p-4">
            {customerPhone && (
              <a href={`tel:${customerPhone}`} className="flex h-13 min-h-[52px] items-center gap-3 rounded-xl border border-line bg-white px-4 text-[15px] font-medium text-ink hover:bg-cream">
                <IconPhone size={18} className="text-success" /> Call the customer
              </a>
            )}
            <a href={`tel:${SUPPORT_PHONE}`} className="flex min-h-[52px] items-center gap-3 rounded-xl border border-line bg-white px-4 text-[15px] font-medium text-ink hover:bg-cream">
              <IconPhone size={18} className="text-info" /> Call Fitzo support
            </a>
            <button
              type="button"
              onClick={() => { setMode("report"); setPreset(null); setNote(""); setErr(null); }}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-line bg-white px-4 text-left text-[15px] font-medium text-ink hover:bg-cream"
            >
              <IconLifebuoy size={18} className="text-warn" /> Report an issue (keep going)
            </button>
            {canFail && (
              <button
                type="button"
                onClick={() => { setMode("fail"); setPreset(null); setNote(""); setErr(null); }}
                className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-danger-line bg-white px-4 text-left text-[15px] font-medium text-danger hover:bg-danger-bg"
              >
                <IconX size={18} /> Can't deliver — end this job
              </button>
            )}
          </div>
        )}

        {(mode === "report" || mode === "fail") && (
          <div className="space-y-3 p-4">
            {mode === "fail" && (
              <Banner kind="err">
                This ends the job: the order is cancelled, support is notified, and you must
                return the items to the store. Call the customer first if you haven't.
              </Banner>
            )}
            <div className="space-y-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={[
                    "flex min-h-[48px] w-full items-center rounded-xl border px-4 text-left text-[14px] font-medium transition",
                    preset === p ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-cream",
                  ].join(" ")}
                >
                  {p}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={mode === "fail" ? "Anything support should know (required for 'Other')" : "Add details (optional)"}
              className="w-full rounded-xl border border-line-strong bg-white p-3.5 text-[15px] text-ink outline-none placeholder:text-faint focus:border-ink"
            />
            {err && <Banner kind="err">{err}</Banner>}
            <button
              type="button"
              disabled={sending}
              onClick={mode === "fail" ? submitFail : submitReport}
              className={
                mode === "fail"
                  ? "flex h-14 w-full items-center justify-center rounded-2xl bg-danger px-4 text-[16px] font-semibold text-white transition hover:bg-danger-strong disabled:opacity-60"
                  : btnPrimary
              }
            >
              {sending ? "Sending…" : mode === "fail" ? "End job & notify support" : "Send report"}
            </button>
          </div>
        )}
      </div>
    </div>
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
