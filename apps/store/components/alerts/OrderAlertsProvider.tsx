"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";
import { loadStoreOrder } from "@/lib/orders";

type AlertItem = {
  orderId: string;
  orderNumber: string;
  itemCount: number;
  subtotal: number;
  at: number;
};

const MUTE_KEY = "fitzo-store-alerts-muted";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function timeAgo(at: number) {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  return `${m}m ago`;
}

/**
 * Live new-order alerts for the store. Subscribes to the manager's own
 * `notifications` INSERTs (kind='new_store_order', created by the trigger in
 * migration 022) and dedupes by order_id so a multi-item order pops once.
 *
 * We deliberately do NOT subscribe to `order_items` directly: its RLS policy is a
 * join through `products` (is_store_manager_of), which Supabase Realtime can't
 * reliably evaluate to route a postgres_changes event — so that approach silently
 * stopped delivering. notifications has the plain `user_id = auth.uid()` policy
 * Realtime routes for free. Renders a pop-up stack + a bell with the session
 * history; plays a chime unless muted.
 */
export function OrderAlertsProvider() {
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
    // Two quick rising notes.
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
      setActiveIds((prev) => [item.orderId, ...prev].slice(0, 4));
      setUnread((u) => u + 1);
      playChime();
    },
    [playChime],
  );

  useEffect(() => {
    setMuted(typeof window !== "undefined" && localStorage.getItem(MUTE_KEY) === "1");

    // Browsers block audio until a user gesture — unlock the AudioContext once.
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
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const handleNewOrder = (orderId: string) => {
      if (handledRef.current.has(orderId)) return;
      handledRef.current.add(orderId);
      setTimeout(async () => {
        try {
          const order = await loadStoreOrder(orderId);
          if (order) {
            pushAlert({
              orderId: order.id,
              orderNumber: order.orderNumber,
              itemCount: order.itemCount,
              subtotal: order.subtotal,
              at: Date.now(),
            });
          }
        } catch {
          /* ignore */
        }
      }, 400);
    };

    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId || stopped) return;

      // PRIMARY: poll this manager's own notifications. Reliable regardless of
      // whether Realtime routes the event (it often doesn't for store sessions).
      const seededRef = { current: false };
      const poll = async () => {
        const { data: rows } = await supabase
          .from("notifications")
          .select("id, data, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(15);
        if (!rows) return;
        // On the first poll, just mark existing new-order notifications as seen
        // so we don't pop a backlog on page load — only pop ones that arrive after.
        for (const r of rows) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const d = ((r as any).data ?? {}) as { kind?: string; order_id?: string };
          if (d.kind !== "new_store_order" || !d.order_id) continue;
          const key = `notif-${(r as { id: string }).id}`;
          if (handledRef.current.has(key)) continue;
          handledRef.current.add(key);
          if (seededRef.current) handleNewOrder(d.order_id);
        }
        seededRef.current = true;
      };
      poll();
      pollId = setInterval(poll, 8000);

      // SECONDARY: Realtime for instant delivery when it does route.
      channel = supabase
        .channel("store-new-orders")
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
            const data = (row?.data ?? {}) as { kind?: string; order_id?: string };
            if (data.kind !== "new_store_order" || !data.order_id) return;
            handledRef.current.add(`notif-${row.id}`);
            handleNewOrder(data.order_id);
          },
        )
        .subscribe();
    });

    return () => {
      stopped = true;
      window.removeEventListener("pointerdown", unlock);
      if (pollId) clearInterval(pollId);
      if (channel) supabase.removeChannel(channel);
    };
  }, [pushAlert]);

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

  const openOrder = (orderId: string) => {
    setActiveIds((prev) => prev.filter((id) => id !== orderId));
    setBellOpen(false);
    router.push(`/orders/${orderId}`);
  };

  const dismiss = (orderId: string) =>
    setActiveIds((prev) => prev.filter((id) => id !== orderId));

  const activeAlerts = activeIds
    .map((id) => alerts.find((a) => a.orderId === id))
    .filter((a): a is AlertItem => Boolean(a));

  return (
    <>
      {/* Bell */}
      <div className="fixed right-4 top-4 z-[60]">
        <button
          type="button"
          onClick={() => {
            setBellOpen((o) => !o);
            setUnread(0);
          }}
          aria-label="Order alerts"
          className="relative grid h-11 w-11 place-items-center rounded-full border border-[#ece5da] bg-white text-[18px] shadow-[0_8px_24px_rgba(32,26,19,0.12)]"
        >
          🔔
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#b83c24] px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>

        {bellOpen ? (
          <div className="absolute right-0 mt-2 w-[300px] overflow-hidden rounded-2xl border border-[#ece5da] bg-white shadow-[0_24px_60px_rgba(32,26,19,0.18)]">
            <div className="flex items-center justify-between border-b border-[#f0ebe3] px-4 py-3">
              <p className="text-[13px] font-semibold text-[#171d2b]">Order alerts</p>
              <button
                type="button"
                onClick={toggleMute}
                className="text-[11px] font-semibold text-[#806f5c] hover:text-[#171d2b]"
              >
                {muted ? "🔇 Unmute" : "🔔 Mute"}
              </button>
            </div>
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-[#958675]">
                No new orders yet today.
              </p>
            ) : (
              <ul className="max-h-[320px] overflow-y-auto">
                {alerts.map((a) => (
                  <li key={`${a.orderId}-${a.at}`}>
                    <button
                      type="button"
                      onClick={() => openOrder(a.orderId)}
                      className="flex w-full items-center justify-between gap-3 border-b border-[#f4efe7] px-4 py-3 text-left last:border-0 hover:bg-[#fbfaf7]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[12px] font-semibold text-[#171d2b]">
                          {a.orderNumber}
                        </p>
                        <p className="text-[11px] text-[#958675]">
                          {a.itemCount} item{a.itemCount === 1 ? "" : "s"} · {timeAgo(a.at)}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold text-[#171d2b]">
                        {formatCurrency(a.subtotal)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {/* Pop-up stack */}
      <div className="fixed bottom-4 right-4 z-[55] flex w-[300px] flex-col gap-3">
        {activeAlerts.map((a) => (
          <div
            key={a.orderId}
            className="overflow-hidden rounded-2xl border border-[#f2e2a8] bg-white shadow-[0_24px_60px_rgba(32,26,19,0.2)]"
          >
            <div className="flex items-start justify-between gap-2 bg-[#ffd233] px-4 py-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#171d2b]">
                🛍 New order
              </p>
              <button
                type="button"
                onClick={() => dismiss(a.orderId)}
                aria-label="Dismiss"
                className="text-[14px] leading-none text-[#171d2b]/60 hover:text-[#171d2b]"
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="font-mono text-[13px] font-semibold text-[#171d2b]">{a.orderNumber}</p>
              <p className="mt-0.5 text-[12px] text-[#958675]">
                {a.itemCount} item{a.itemCount === 1 ? "" : "s"} · {formatCurrency(a.subtotal)}
              </p>
              <button
                type="button"
                onClick={() => openOrder(a.orderId)}
                className="mt-3 w-full rounded-full bg-[#171d2b] py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#1f2a3c]"
              >
                View order →
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
