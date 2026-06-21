"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@fitzo/supabase/client";
import { createKeepPayment, confirmKeepPayment, returnItem, startTryWindow } from "./actions";
import type { OrderStatus, ItemDecision } from "@fitzo/supabase/types";

// ─────────────────────────────────────────────
// Razorpay Checkout (loaded on demand from their CDN)
// ─────────────────────────────────────────────

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, cb: (response: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─────────────────────────────────────────────
// Types (serialised from server)
// ─────────────────────────────────────────────

export type TrackingOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  final_amount: number;
  created_at: string;
};

export type TrackingItem = {
  id: string;
  product_name: string;
  color_name: string;
  size: string;
  price_at_order: number;
  image_url: string | null;
  decision: ItemDecision;
};

export type TrackingSession = {
  deadline_at: string;
  status: string;
} | null;

// ─────────────────────────────────────────────
// Status timeline config
// ─────────────────────────────────────────────

const STATUS_ORDER: OrderStatus[] = [
  "pending",
  "confirmed",
  "assigned",
  "out_for_delivery",
  "delivered",
  "try_window_active",
  "return_requested",
  "return_picked",
  "completed",
];

const TIMELINE = [
  { reachedAt: "pending",           label: "Order placed",       sub: "Your order is queued" },
  { reachedAt: "confirmed",         label: "Confirmed",          sub: "Store is preparing your items" },
  { reachedAt: "out_for_delivery",  label: "Out for delivery",   sub: "Rider is on the way to you" },
  { reachedAt: "delivered",         label: "Delivered",          sub: "Your order has arrived" },
  { reachedAt: "try_window_active", label: "Try window open",    sub: "Try on while the rider waits (7 min)" },
  { reachedAt: "completed",         label: "Completed",          sub: "All done!" },
] as const;

function stepState(
  stepReachedAt: string,
  currentStatus: OrderStatus,
): "done" | "active" | "upcoming" {
  const si = STATUS_ORDER.indexOf(stepReachedAt as OrderStatus);
  const ci = STATUS_ORDER.indexOf(currentStatus);
  if (ci > si) return "done";
  if (ci === si) return "active";
  return "upcoming";
}

// ─────────────────────────────────────────────
// Live countdown hook
// ─────────────────────────────────────────────

type TimeLeft = { hours: number; minutes: number; seconds: number; expired: boolean };

function calcTimeLeft(deadlineAt: string): TimeLeft {
  const diff = new Date(deadlineAt).getTime() - Date.now();
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, expired: true };
  const s = Math.floor(diff / 1000);
  return {
    hours:   Math.floor(s / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    expired: false,
  };
}

function useCountdown(deadlineAt: string | null): TimeLeft | null {
  const [left, setLeft] = useState<TimeLeft | null>(
    deadlineAt ? calcTimeLeft(deadlineAt) : null,
  );

  useEffect(() => {
    if (!deadlineAt) return;
    setLeft(calcTimeLeft(deadlineAt));
    const id = setInterval(() => setLeft(calcTimeLeft(deadlineAt)), 1000);
    return () => clearInterval(id);
  }, [deadlineAt]);

  return left;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function OrderTrackingView({
  order,
  items: initialItems,
  trySession,
}: {
  order: TrackingOrder;
  items: TrackingItem[];
  trySession: TrackingSession;
}) {
  const router = useRouter();
  const timeLeft = useCountdown(trySession?.deadline_at ?? null);

  // Local optimistic decisions so UI updates immediately on click
  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>(
    () => Object.fromEntries(initialItems.map((i) => [i.id, i.decision])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [startingWindow, setStartingWindow] = useState(false);
  const [windowDismissed, setWindowDismissed] = useState(false);

  // Live updates: when the rider marks the order delivered, or the window
  // starts, refresh the server data so the prompt / countdown appears instantly.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`order-${order.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${order.id}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "try_sessions", filter: `order_id=eq.${order.id}` }, () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [order.id, router]);

  // The rider has delivered; the customer hasn't started the window yet.
  const awaitingTryStart = order.status === "delivered" && !windowDismissed;

  async function handleStartWindow() {
    setStartingWindow(true);
    setActionError(null);
    const result = await startTryWindow(order.id);
    setStartingWindow(false);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    router.refresh();
  }

  const tryWindowLive =
    order.status === "try_window_active" && !!timeLeft && !timeLeft.expired;

  async function handleKeep(itemId: string) {
    if (pendingId) return;
    setPendingId(itemId);
    setActionError(null);

    const reset = () => {
      setPendingId(null);
      setDecisions((prev) => ({ ...prev, [itemId]: "pending" }));
    };

    // 1. Create the Razorpay order + pending payment row (amount is server-computed).
    const payment = await createKeepPayment(itemId, order.id);
    if (!payment.success) {
      setActionError(payment.error);
      setPendingId(null);
      return;
    }

    // 2. Make sure the Checkout script is available.
    const ready = await loadRazorpayScript();
    if (!ready || !window.Razorpay) {
      setActionError("Couldn't load the payment window. Check your connection and try again.");
      setPendingId(null);
      return;
    }

    // 3. Open Checkout. The item only flips to "keep" after the server verifies payment.
    const rzp = new window.Razorpay({
      key: payment.keyId,
      amount: payment.amount,
      currency: payment.currency,
      name: "Fitzo",
      description: `Keep — ${payment.productName}`,
      order_id: payment.rzpOrderId,
      theme: { color: "#171d2b" },
      modal: {
        ondismiss: () => {
          setActionError("Payment cancelled — the item is still up for decision.");
          setPendingId(null);
        },
      },
      handler: async (response) => {
        const result = await confirmKeepPayment({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
          orderId: order.id,
        });
        setPendingId(null);
        if (!result.success) {
          setActionError(result.error);
          return;
        }
        setDecisions((prev) => ({ ...prev, [itemId]: "keep" }));
        router.refresh();
      },
    });

    rzp.on("payment.failed", (resp) => {
      setActionError(resp.error?.description ?? "Payment failed. Please try again.");
      reset();
    });

    rzp.open();
  }

  async function handleReturn(itemId: string) {
    if (pendingId) return;
    setPendingId(itemId);
    setActionError(null);
    setDecisions((prev) => ({ ...prev, [itemId]: "return" }));

    const result = await returnItem(itemId, order.id);
    setPendingId(null);

    if (!result.success) {
      setDecisions((prev) => ({ ...prev, [itemId]: "pending" }));
      setActionError(result.error);
    } else {
      router.refresh();
    }
  }

  const keptTotal = initialItems
    .filter((i) => decisions[i.id] === "keep")
    .reduce((s, i) => s + i.price_at_order, 0);

  const allDecided = initialItems.every((i) => decisions[i.id] !== "pending");

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      {/* ── Doorstep prompt: rider delivered → start the 7-min window ── */}
      {awaitingTryStart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ animation: "fitzo-fade-in 180ms ease-out both" }}>
          <div className="absolute inset-0 bg-[#171d2b]/50 backdrop-blur-[3px]" />
          <div
            className="relative w-full max-w-[420px] overflow-hidden rounded-[24px] border border-[#ece4da] bg-[#fbfaf7] shadow-[0_24px_70px_-20px_rgba(23,29,43,0.5)]"
            style={{ animation: "fitzo-pop-in 260ms cubic-bezier(0.18,0.89,0.32,1.28) both" }}
          >
            <div className="h-2 w-full bg-gradient-to-r from-[#171d2b] via-[#8b7058] to-[#c89b3c]" />
            <div className="px-7 pb-7 pt-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#171d2b]">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2v-8a2 2 0 00-2-2M5 8l2-4h10l2 4" />
                </svg>
              </div>
              <h2 className="mt-5 font-display text-[26px] leading-tight text-[#171717]">Your order has arrived!</h2>
              <p className="mx-auto mt-2 max-w-[330px] text-[14px] leading-6 text-[#5f5851]">
                Your rider is at the door and waiting. Start your <strong>7-minute try-on window</strong> —
                try everything on, keep &amp; pay for what you love, and hand the rest back right away.
              </p>
              {actionError && (
                <p className="mt-3 rounded-[10px] bg-[#fdecea] px-3 py-2 text-[12px] text-[#c0392b]">{actionError}</p>
              )}
              <button
                type="button"
                onClick={handleStartWindow}
                disabled={startingWindow}
                className="mt-6 w-full rounded-[14px] bg-[#171d2b] px-5 py-3.5 text-[14px] font-semibold text-white transition hover:bg-[#2a3345] disabled:opacity-60"
              >
                {startingWindow ? "Starting…" : "Accept & start 7-min try-on"}
              </button>
              <button
                type="button"
                onClick={() => setWindowDismissed(true)}
                className="mt-2 w-full rounded-[14px] px-5 py-3 text-[13px] font-medium text-[#8b7058] transition hover:text-[#171717]"
              >
                Cancel
              </button>
            </div>
          </div>
          <style>{`
            @keyframes fitzo-fade-in { from { opacity: 0 } to { opacity: 1 } }
            @keyframes fitzo-pop-in { 0% { opacity: 0; transform: translateY(12px) scale(0.96) } 100% { opacity: 1; transform: translateY(0) scale(1) } }
          `}</style>
        </div>
      )}

      <div className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-6">

        {/* ── Header ── */}
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#8b7058] hover:text-[#171717]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          My orders
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
              Order tracking
            </p>
            <h1 className="mt-1 font-display text-[34px] leading-tight text-[#171717]">
              {order.order_number}
            </h1>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* ── Cancelled banner ── */}
        {order.status === "cancelled" && (
          <div className="mt-6 rounded-[14px] bg-[#fdecea] px-5 py-4 text-[#c0392b]">
            <p className="font-medium">This order has been cancelled.</p>
          </div>
        )}

        {/* ── Status timeline ── */}
        {order.status !== "cancelled" && (
          <div className="mt-8">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
              Status
            </p>
            <ol className="mt-4 space-y-0">
              {TIMELINE.map((step, idx) => {
                const state = stepState(step.reachedAt, order.status);
                const isLast = idx === TIMELINE.length - 1;
                return (
                  <li key={step.reachedAt} className="relative flex gap-4">
                    {/* Connector line */}
                    {!isLast && (
                      <div
                        className={[
                          "absolute left-[11px] top-6 w-0.5 bottom-0",
                          state === "done" ? "bg-[#171d2b]" : "bg-[#e5e0d8]",
                        ].join(" ")}
                      />
                    )}

                    {/* Dot */}
                    <div className="relative z-10 mt-1 flex-none">
                      {state === "done" && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#171d2b]">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      {state === "active" && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#171d2b] ring-4 ring-[#e8e1d8]">
                          <div className="h-2 w-2 rounded-full bg-white" />
                        </div>
                      )}
                      {state === "upcoming" && (
                        <div className="h-6 w-6 rounded-full border-2 border-[#ddd4c9] bg-[#fbfaf7]" />
                      )}
                    </div>

                    {/* Label */}
                    <div className="pb-6">
                      <p className={[
                        "text-[14px] font-medium",
                        state === "upcoming" ? "text-[#bdb5ab]" : "text-[#171717]",
                      ].join(" ")}>
                        {step.label}
                      </p>
                      {state !== "upcoming" && (
                        <p className="text-[12px] text-[#8b7058]">{step.sub}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* ── Try window countdown ── */}
        {trySession && order.status === "try_window_active" && (
          <div className={[
            "mt-2 rounded-[18px] p-5",
            timeLeft?.expired ? "bg-[#fdecea]" : "bg-[#171d2b]",
          ].join(" ")}>
            {timeLeft?.expired ? (
              <>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#c0392b]">
                  Try window closed
                </p>
                <p className="mt-1 text-[14px] text-[#c0392b]">
                  Your try window has ended. The rider has taken back anything you didn&apos;t keep.
                </p>
              </>
            ) : (
              <>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b9bb5]">
                  Time remaining to decide
                </p>
                {timeLeft && (
                  <div className="mt-3 flex gap-4">
                    {[
                      { value: timeLeft.hours,   label: "HRS"  },
                      { value: timeLeft.minutes, label: "MIN"  },
                      { value: timeLeft.seconds, label: "SEC"  },
                    ].map(({ value, label }) => (
                      <div key={label} className="text-center">
                        <p className="font-mono text-[42px] font-bold leading-none tabular-nums text-white">
                          {pad(value)}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[#8b9bb5]">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[12px] text-[#8b9bb5]">
                  Deadline:{" "}
                  {new Date(trySession.deadline_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </>
            )}
          </div>
        )}

        {/* Delivered but try window not yet triggered */}
        {order.status === "delivered" && (
          <div className="mt-4 rounded-[14px] bg-[#f4ede4] px-5 py-4">
            <p className="text-[13px] font-medium text-[#8b7058]">
              Your order has been delivered. Your try window with the rider will open shortly.
            </p>
          </div>
        )}

        {/* ── Action error ── */}
        {actionError && (
          <div className="mt-4 rounded-[12px] bg-[#fdecea] px-4 py-3 text-[13px] text-[#c0392b]">
            {actionError}
          </div>
        )}

        {/* ── Items ── */}
        <div className="mt-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
            Items
          </p>
          <ul className="mt-3 space-y-3">
            {initialItems.map((item) => {
              const decision = decisions[item.id];
              const isPending = pendingId === item.id;

              return (
                <li
                  key={item.id}
                  className="flex gap-4 rounded-[16px] border border-[#ece4da] bg-white p-4"
                >
                  {/* Image */}
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.product_name}
                      className="h-16 w-16 flex-none rounded-[10px] object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 flex-none rounded-[10px] bg-[#f4ede4]" />
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[#171717]">
                      {item.product_name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#8b7058]">
                      {item.color_name} · {item.size}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[#3b3732]">
                      ₹{item.price_at_order.toLocaleString("en-IN")}
                    </p>

                    {/* Decision badge / buttons */}
                    <div className="mt-3">
                      {decision === "keep" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf6ed] px-3 py-1 text-[12px] font-semibold text-[#2e7d52]">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Keeping
                        </span>
                      )}
                      {decision === "return" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff4e5] px-3 py-1 text-[12px] font-semibold text-[#b45309]">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Return requested
                        </span>
                      )}
                      {decision === "pending" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!tryWindowLive || !!pendingId}
                            onClick={() => handleKeep(item.id)}
                            className={[
                              "rounded-[10px] px-4 py-1.5 text-[12px] font-semibold transition",
                              tryWindowLive && !pendingId
                                ? "bg-[#171d2b] text-white hover:bg-[#2a3345]"
                                : "cursor-not-allowed bg-[#e5e0d8] text-[#bdb5ab]",
                              isPending ? "opacity-60" : "",
                            ].join(" ")}
                          >
                            {isPending ? "…" : "Keep"}
                          </button>
                          <button
                            type="button"
                            disabled={!tryWindowLive || !!pendingId}
                            onClick={() => handleReturn(item.id)}
                            className={[
                              "rounded-[10px] border px-4 py-1.5 text-[12px] font-semibold transition",
                              tryWindowLive && !pendingId
                                ? "border-[#ddd4c9] text-[#5f5851] hover:border-[#c0392b] hover:text-[#c0392b]"
                                : "cursor-not-allowed border-[#e5e0d8] text-[#bdb5ab]",
                              isPending ? "opacity-60" : "",
                            ].join(" ")}
                          >
                            {isPending ? "…" : "Return"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Try window hint when not yet active ── */}
        {order.status !== "try_window_active" &&
          order.status !== "completed" &&
          order.status !== "cancelled" && (
          <p className="mt-4 text-[12px] text-[#bdb5ab]">
            Keep / Return buttons unlock once your order is delivered and the try window opens.
          </p>
        )}

        {/* ── Amount summary ── */}
        <div className="mt-6 rounded-[16px] border border-[#ece4da] bg-white px-5 py-4">
          {allDecided ? (
            <>
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-[#5f5851]">Items you&apos;re keeping</span>
                <span className="font-medium text-[#171717]">
                  ₹{keptTotal.toLocaleString("en-IN")}
                </span>
              </div>
              {keptTotal === 0 && (
                <p className="mt-2 text-[12px] text-[#8b7058]">
                  Returning everything — a pickup will be scheduled.
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#5f5851]">Total (if you keep everything)</span>
              <span className="font-medium text-[#171717]">
                ₹{order.final_amount.toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>

        {/* ── Footer CTA ── */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/products"
            className="flex-1 rounded-[14px] border border-[#ddd4c9] px-5 py-3 text-center text-[13px] font-medium text-[#171717] transition hover:border-[#171d2b]"
          >
            Continue shopping
          </Link>
          <Link
            href="/orders"
            className="flex-1 rounded-[14px] bg-[#171d2b] px-5 py-3 text-center text-[13px] font-medium text-white transition hover:bg-[#2a3345]"
          >
            All orders
          </Link>
        </div>

      </div>
    </main>
  );
}

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  pending:           "Order placed",
  confirmed:         "Confirmed",
  assigned:          "Rider assigned",
  out_for_delivery:  "On the way",
  delivered:         "Delivered",
  try_window_active: "Try window open",
  return_requested:  "Return requested",
  return_picked:     "Return picked up",
  completed:         "Completed",
  cancelled:         "Cancelled",
};

const STATUS_STYLE: Partial<Record<OrderStatus, string>> = {
  pending:           "bg-[#fff8e1] text-[#856d00]",
  confirmed:         "bg-[#e8f4fd] text-[#1565c0]",
  assigned:          "bg-[#e8f4fd] text-[#1565c0]",
  out_for_delivery:  "bg-[#e8f4fd] text-[#1565c0]",
  delivered:         "bg-[#eaf6ed] text-[#2e7d52]",
  try_window_active: "bg-[#171d2b] text-white",
  return_requested:  "bg-[#fff4e5] text-[#b45309]",
  return_picked:     "bg-[#fff4e5] text-[#b45309]",
  completed:         "bg-[#eaf6ed] text-[#2e7d52]",
  cancelled:         "bg-[#fdecea] text-[#c0392b]",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={[
      "rounded-full px-3 py-1 text-[12px] font-semibold",
      STATUS_STYLE[status] ?? "bg-[#f4ede4] text-[#8b7058]",
    ].join(" ")}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
