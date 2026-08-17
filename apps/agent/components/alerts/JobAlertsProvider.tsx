"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitxo/supabase/client";
import {
  IconBell,
  IconBellOff,
  IconCheck,
  IconPackage,
  IconScooter,
  IconShirt,
  IconX,
} from "@/components/icons";

type AlertKind = "job" | "try" | "return" | "keep";

type AlertItem = {
  id: string; // dedupe/react key
  kind: AlertKind;
  deliveryId: string | null;
  orderNumber: string;
  detail: string;
  at: number;
};

const MUTE_KEY = "fitxo-agent-alerts-muted";

const KIND_META: Record<
  AlertKind,
  { label: string; icon: ComponentType<{ size?: number }>; chip: string; iconChip: string }
> = {
  job: { label: "New job", icon: IconScooter, chip: "bg-ink text-accent", iconChip: "bg-accent-pale text-ink" },
  try: { label: "Try-on started", icon: IconShirt, chip: "bg-success text-white", iconChip: "bg-success-bg text-success" },
  return: { label: "Item to collect", icon: IconPackage, chip: "bg-warn-accent text-white", iconChip: "bg-warn-bg text-warn" },
  keep: { label: "Item kept", icon: IconCheck, chip: "bg-info text-white", iconChip: "bg-info-bg text-info" },
};

function timeAgo(at: number) {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return "just now";
  return `${Math.round(s / 60)}m ago`;
}

/**
 * Live rider alerts. Every event arrives as a born-visible `notifications` row
 * owned by this rider (migrations 021 + 023), so Supabase Realtime routes them
 * reliably via the simple `user_id = auth.uid()` policy. We deliberately do NOT
 * subscribe to `deliveries`/`try_sessions`/`order_items` directly — their RLS is
 * join-based, which Realtime can't reliably evaluate to route postgres_changes.
 * data.kind discriminates the event:
 *   • new_job       → admin assigned me a delivery
 *   • try_started   → the customer started their try-on
 *   • item_kept     → the customer is keeping an item
 *   • item_returned → the customer is returning an item (collect it)
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
    // Vibrate too — audio needs a tap-to-unlock and dies in a pocket (audit M2).
    try {
      navigator.vibrate?.(180);
    } catch {
      /* unsupported */
    }
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
    // Shared mute with IncomingJobsProvider (one switch for the whole app).
    const onMute = (e: Event) => setMuted(!!(e as CustomEvent).detail);
    window.addEventListener("fitxo-mute-change", onMute);

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

    // All rider alerts arrive as born-visible `notifications` rows (migrations
    // 021 + 023), so Realtime routes them reliably via the simple
    // `user_id = auth.uid()` policy — no join-based RLS to mis-route.
    const channel = supabase
      .channel("agent-job-alerts")
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
          const data = (row?.data ?? {}) as {
            kind?: string;
            delivery_id?: string;
            order_id?: string;
            order_item_id?: string;
            product_name?: string;
          };

          const meta: Record<string, { kind: AlertKind; detail: string }> = {
            new_job: { kind: "job", detail: "Tap to accept this delivery" },
            try_started: { kind: "try", detail: "Customer is trying items on — please wait" },
            item_returned: {
              kind: "return",
              detail: `${data.product_name ?? "An item"} — collect it back`,
            },
            item_kept: {
              kind: "keep",
              detail: `${data.product_name ?? "An item"} — customer is keeping it`,
            },
          };
          const m = data.kind ? meta[data.kind] : undefined;
          if (!m) return;

          const key = `${data.kind}-${data.order_item_id ?? data.delivery_id ?? row?.id}`;
          if (handledRef.current.has(key)) return;
          handledRef.current.add(key);

          setTimeout(async () => {
            const order = data.order_id ? await lookupOrder(data.order_id) : null;
            pushAlert({
              id: key,
              kind: m.kind,
              deliveryId: data.delivery_id ?? order?.deliveryId ?? null,
              orderNumber: order?.orderNumber ?? "Order",
              detail: m.detail,
              at: Date.now(),
            });
          }, 300);
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("fitxo-mute-change", onMute);
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
      window.dispatchEvent(new CustomEvent("fitxo-mute-change", { detail: next }));
      return next;
    });
  };

  const open = (item: AlertItem) => {
    // Remove from both the pop-up stack and the bell history so a tapped alert
    // visibly goes away instead of lingering in the list.
    setActiveIds((prev) => prev.filter((id) => id !== item.id));
    setAlerts((prev) => prev.filter((a) => a.id !== item.id));
    setBellOpen(false);
    if (item.deliveryId) router.push(`/deliveries/${item.deliveryId}`);
  };

  const dismiss = (id: string) => setActiveIds((prev) => prev.filter((x) => x !== id));

  const clearAll = () => {
    setAlerts([]);
    setActiveIds([]);
    setUnread(0);
  };

  const activeAlerts = activeIds
    .map((id) => alerts.find((a) => a.id === id))
    .filter((a): a is AlertItem => Boolean(a));

  return (
    <>
      {/* Bell — floats top-right; the mobile header reserves space for it */}
      <div className="fixed right-3 top-3 z-[60] lg:right-5 lg:top-4">
        <button
          type="button"
          onClick={() => {
            setBellOpen((o) => !o);
            setUnread(0);
          }}
          aria-label="Job alerts"
          className="relative grid h-11 w-11 place-items-center rounded-full border border-line bg-white text-ink shadow-float"
        >
          <IconBell size={19} />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>

        {bellOpen ? (
          <div className="absolute right-0 mt-2 w-[300px] overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-[14px] font-semibold text-ink">Job alerts</p>
              <div className="flex items-center gap-1">
                {alerts.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex h-9 items-center rounded-full px-2.5 text-[12px] font-semibold text-soft hover:bg-cream hover:text-ink"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-soft hover:bg-cream hover:text-ink"
                >
                  {muted ? <IconBellOff size={14} /> : <IconBell size={14} />}
                  {muted ? "Unmute" : "Mute"}
                </button>
              </div>
            </div>
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-soft">
                No alerts yet. New jobs land here.
              </p>
            ) : (
              <ul className="max-h-[320px] overflow-y-auto">
                {alerts.map((a) => {
                  const Meta = KIND_META[a.kind];
                  const Icon = Meta.icon;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => open(a)}
                        className="flex w-full items-start gap-3 border-b border-hairline px-4 py-3 text-left last:border-0 hover:bg-cream"
                      >
                        <span
                          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${Meta.iconChip}`}
                        >
                          <Icon size={15} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-ink">
                            {Meta.label} · {a.orderNumber}
                          </p>
                          <p className="truncate text-[12px] text-body">{a.detail}</p>
                          <p className="text-[11px] text-faint">{timeAgo(a.at)}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {/* Pop-up stack */}
      <div className="fixed bottom-24 right-3 z-[55] flex w-[290px] flex-col gap-3 lg:bottom-5 lg:right-5">
        {activeAlerts.map((a) => {
          const meta = KIND_META[a.kind];
          const Icon = meta.icon;
          return (
            <div
              key={a.id}
              className="overflow-hidden rounded-2xl border border-line bg-white shadow-pop"
            >
              <div className={`flex items-center justify-between gap-2 px-4 py-2 ${meta.chip}`}>
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
                  <Icon size={14} /> {meta.label}
                </p>
                <button
                  type="button"
                  onClick={() => dismiss(a.id)}
                  aria-label="Dismiss"
                  className="grid h-7 w-7 place-items-center rounded-full opacity-75 hover:opacity-100"
                >
                  <IconX size={14} />
                </button>
              </div>
              <div className="px-4 py-3">
                <p className="text-[14px] font-semibold text-ink">{a.orderNumber}</p>
                <p className="mt-0.5 text-[13px] text-body">{a.detail}</p>
                {a.deliveryId ? (
                  <button
                    type="button"
                    onClick={() => open(a)}
                    className="mt-3 h-11 w-full rounded-full bg-ink text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink-soft"
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
