"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";

type AlertKind = "job" | "try" | "return" | "keep";

type AlertItem = {
  id: string; // dedupe/react key
  kind: AlertKind;
  deliveryId: string | null;
  orderNumber: string;
  detail: string;
  at: number;
};

const MUTE_KEY = "fitzo-agent-alerts-muted";

const KIND_META: Record<AlertKind, { label: string; icon: string; accent: string }> = {
  job: { label: "New job", icon: "🛵", accent: "#3b82f6" },
  try: { label: "Try-on started", icon: "👕", accent: "#34d399" },
  return: { label: "Item to collect", icon: "↩️", accent: "#f59e0b" },
  keep: { label: "Item kept", icon: "✅", accent: "#a78bfa" },
};

function timeAgo(at: number) {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return "just now";
  return `${Math.round(s / 60)}m ago`;
}

/**
 * Live rider alerts. Supabase Realtime routes events by RLS, so we only ever
 * receive rows for this rider:
 *   • notifications INSERT → admin assigned me a job (data.kind='new_job').
 *     Routed through a born-visible notification (migration 021) because an
 *     assign-UPDATE on `deliveries` moves the row *into* RLS visibility, which
 *     postgres_changes does not reliably deliver.
 *   • try_sessions        → the customer started their try-on (status='active')
 *   • order_items UPDATE  → the customer decided an item (keep / return)
 * Mirrors the Store/Admin new-order pop-up: pop-up stack + bell history + chime.
 */
export function JobAlertsProvider({ userId }: { userId: string }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  const handledRef = useRef<Set<string>>(new Set());
  const mutedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const playChime = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = audioRef.current;
    if (!ctx || ctx.state !== "running") return;
    [0, 0.16].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = i === 0 ? 660 : 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.24);
    });
  }, []);

  const pushAlert = useCallback(
    (item: AlertItem) => {
      setAlerts((prev) => [item, ...prev].slice(0, 50));
      setActiveIds((prev) => [item.id, ...prev].slice(0, 4));
      setUnread((u) => u + 1);
      playChime();
    },
    [playChime],
  );

  useEffect(() => {
    setMuted(typeof window !== "undefined" && localStorage.getItem(MUTE_KEY) === "1");

    const unlock = () => {
      if (!audioRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Ctor = window.AudioContext || (window as any).webkitAudioContext;
          if (Ctor) audioRef.current = new Ctor();
        } catch {
          /* ignore */
        }
      }
      audioRef.current?.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });

    const supabase = createClient();

    // order_id → { deliveryId, orderNumber } for the try/decision events (which
    // carry only order_id). RLS scopes the lookup to this rider's own deliveries.
    const lookupOrder = async (orderId: string) => {
      const { data } = await supabase
        .from("deliveries")
        .select("id, order:orders(order_number)")
        .eq("order_id", orderId)
        .maybeSingle();
      if (!data) return null;
      const order = Array.isArray(data.order) ? data.order[0] : data.order;
      return { deliveryId: data.id as string, orderNumber: order?.order_number ?? "Order" };
    };

    const channel = supabase
      .channel("agent-job-alerts")
      // New job assigned to me — a born-visible notification (migration 021).
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          const data = (row?.data ?? {}) as { kind?: string; delivery_id?: string; order_id?: string };
          if (data.kind !== "new_job") return;
          const key = `job-${data.delivery_id ?? row?.id}`;
          if (handledRef.current.has(key)) return;
          handledRef.current.add(key);
          setTimeout(async () => {
            const order = data.order_id ? await lookupOrder(data.order_id) : null;
            pushAlert({
              id: key,
              kind: "job",
              deliveryId: data.delivery_id ?? order?.deliveryId ?? null,
              orderNumber: order?.orderNumber ?? "New order",
              detail: "Tap to accept this delivery",
              at: Date.now(),
            });
          }, 300);
        },
      )
      // Customer started their try-on
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "try_sessions" },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          const key = `try-${row?.order_id}`;
          if (!row?.order_id || row.status !== "active" || handledRef.current.has(key)) return;
          handledRef.current.add(key);
          setTimeout(async () => {
            const order = await lookupOrder(row.order_id);
            if (!order) return;
            pushAlert({
              id: key,
              kind: "try",
              deliveryId: order.deliveryId,
              orderNumber: order.orderNumber,
              detail: "Customer is trying items on — please wait",
              at: Date.now(),
            });
          }, 300);
        },
      )
      // Customer decided an item (keep / return)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_items" },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const old = payload.old as any;
          const decision = row?.decision as string | undefined;
          if (!row?.id || (decision !== "keep" && decision !== "return")) return;
          // Only fire on the transition into a decision (old image may be partial).
          if (old?.decision === decision) return;
          const key = `dec-${row.id}-${decision}`;
          if (handledRef.current.has(key)) return;
          handledRef.current.add(key);
          setTimeout(async () => {
            const order = await lookupOrder(row.order_id);
            if (!order) return;
            const name = row.product_name ?? "An item";
            pushAlert({
              id: key,
              kind: decision === "return" ? "return" : "keep",
              deliveryId: order.deliveryId,
              orderNumber: order.orderNumber,
              detail:
                decision === "return"
                  ? `${name} — collect it back`
                  : `${name} — customer is keeping it`,
              at: Date.now(),
            });
          }, 300);
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener("pointerdown", unlock);
      supabase.removeChannel(channel);
    };
  }, [pushAlert, userId]);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const open = (item: AlertItem) => {
    setActiveIds((prev) => prev.filter((id) => id !== item.id));
    setBellOpen(false);
    if (item.deliveryId) router.push(`/deliveries/${item.deliveryId}`);
  };

  const dismiss = (id: string) => setActiveIds((prev) => prev.filter((x) => x !== id));

  const activeAlerts = activeIds
    .map((id) => alerts.find((a) => a.id === id))
    .filter((a): a is AlertItem => Boolean(a));

  return (
    <>
      {/* Bell — floats top-right, clear of the mobile top bar's menu button */}
      <div className="fixed right-3 top-3 z-[60] lg:right-5 lg:top-4">
        <button
          type="button"
          onClick={() => {
            setBellOpen((o) => !o);
            setUnread(0);
          }}
          aria-label="Job alerts"
          className="relative grid h-10 w-10 place-items-center rounded-full border border-[#243049] bg-[#161e2e] text-[16px] text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        >
          🔔
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>

        {bellOpen ? (
          <div className="absolute right-0 mt-2 w-[300px] overflow-hidden rounded-2xl border border-[#243049] bg-[#161e2e] shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-[#243049] px-4 py-3">
              <p className="text-[13px] font-semibold text-white">Job alerts</p>
              <button
                type="button"
                onClick={toggleMute}
                className="text-[11px] font-semibold text-[#7c8aa5] hover:text-white"
              >
                {muted ? "🔇 Unmute" : "🔔 Mute"}
              </button>
            </div>
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-[#7c8aa5]">
                No alerts yet. New jobs land here.
              </p>
            ) : (
              <ul className="max-h-[320px] overflow-y-auto">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => open(a)}
                      className="flex w-full items-start gap-3 border-b border-[#1e293b] px-4 py-3 text-left last:border-0 hover:bg-white/5"
                    >
                      <span className="text-[16px] leading-none">{KIND_META[a.kind].icon}</span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-white">
                          {KIND_META[a.kind].label} · {a.orderNumber}
                        </p>
                        <p className="truncate text-[11px] text-[#7c8aa5]">{a.detail}</p>
                        <p className="text-[10px] text-[#5a6781]">{timeAgo(a.at)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {/* Pop-up stack */}
      <div className="fixed bottom-20 right-3 z-[55] flex w-[290px] flex-col gap-3 lg:bottom-5 lg:right-5">
        {activeAlerts.map((a) => {
          const meta = KIND_META[a.kind];
          return (
            <div
              key={a.id}
              className="overflow-hidden rounded-2xl border bg-[#161e2e] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
              style={{ borderColor: `${meta.accent}66` }}
            >
              <div
                className="flex items-start justify-between gap-2 px-4 py-2"
                style={{ backgroundColor: meta.accent }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0f1522]">
                  {meta.icon} {meta.label}
                </p>
                <button
                  type="button"
                  onClick={() => dismiss(a.id)}
                  aria-label="Dismiss"
                  className="text-[14px] leading-none text-[#0f1522]/70 hover:text-[#0f1522]"
                >
                  ✕
                </button>
              </div>
              <div className="px-4 py-3">
                <p className="text-[13px] font-semibold text-white">{a.orderNumber}</p>
                <p className="mt-0.5 text-[12px] text-[#9fb0cc]">{a.detail}</p>
                {a.deliveryId ? (
                  <button
                    type="button"
                    onClick={() => open(a)}
                    className="mt-3 w-full rounded-full bg-[#3b82f6] py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#2f6fe0]"
                  >
                    {a.kind === "job" ? "View job →" : "Open delivery →"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
