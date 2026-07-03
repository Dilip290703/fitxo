"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitzo/supabase/client";
import { countPendingStoreOrders, loadStoreOrder } from "@/lib/orders";
import { useStorePanel } from "@/components/panel/PanelContext";
import { Icon } from "@/components/icons";
import { formatCurrency, timeAgo } from "@/lib/format";

type AlertItem = {
  orderId: string;
  orderNumber: string;
  itemCount: number;
  subtotal: number;
  at: number;
};

type AlertsApi = {
  alerts: AlertItem[];
  unread: number;
  /** Orders currently waiting for this store to confirm (sidebar badge). */
  pendingCount: number;
  muted: boolean;
  toggleMute: () => void;
  /** Reset the unread counter (bell opened). */
  markRead: () => void;
  openOrder: (orderId: string) => void;
  dismiss: (orderId: string) => void;
  /** Re-count pending orders — call after confirming an order. */
  refreshPending: () => void;
};

const AlertsContext = createContext<AlertsApi | null>(null);

export function useOrderAlerts(): AlertsApi {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useOrderAlerts must be used inside OrderAlertsProvider");
  return ctx;
}

const MUTE_KEY = "fitzo-store-alerts-muted";

/**
 * Live new-order alerts for the store. Mounted ONCE in the panel layout, so
 * alert history, the unread counter and the pending-order badge survive
 * navigation between screens.
 *
 * Delivery mechanism (hard-won, do not "simplify" back to Realtime-only):
 * subscribes to the manager's own `notifications` INSERTs
 * (kind='new_store_order', created by the trigger in migration 022) and
 * dedupes by notification id. The PRIMARY channel is an 8s poll — Supabase
 * Realtime doesn't reliably route events to store sessions; it's kept only as
 * an instant nudge. The first poll seeds silently so a page load never pops a
 * backlog.
 */
export function OrderAlertsProvider({ children }: { children: React.ReactNode }) {
  const { storeId } = useStorePanel();
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
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

  const refreshPending = useCallback(() => {
    countPendingStoreOrders(storeId)
      .then(setPendingCount)
      .catch(() => {
        /* badge is best-effort */
      });
  }, [storeId]);

  const pushAlert = useCallback(
    (item: AlertItem) => {
      setAlerts((prev) => [item, ...prev].slice(0, 50));
      setActiveIds((prev) => [item.orderId, ...prev].slice(0, 4));
      setUnread((u) => u + 1);
      playChime();
      refreshPending();
    },
    [playChime, refreshPending],
  );

  // Pending-order badge: on mount, on each new order (pushAlert), and when the
  // tab regains focus (the owner may have confirmed orders on another device).
  useEffect(() => {
    refreshPending();
    window.addEventListener("focus", refreshPending);
    return () => window.removeEventListener("focus", refreshPending);
  }, [refreshPending]);

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
          const order = await loadStoreOrder(orderId, storeId);
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
  }, [pushAlert, storeId]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const openOrder = useCallback(
    (orderId: string) => {
      setActiveIds((prev) => prev.filter((id) => id !== orderId));
      router.push(`/orders/${orderId}`);
    },
    [router],
  );

  const dismiss = useCallback(
    (orderId: string) => setActiveIds((prev) => prev.filter((id) => id !== orderId)),
    [],
  );

  const markRead = useCallback(() => setUnread(0), []);

  const activeAlerts = activeIds
    .map((id) => alerts.find((a) => a.orderId === id))
    .filter((a): a is AlertItem => Boolean(a));

  return (
    <AlertsContext.Provider
      value={{ alerts, unread, pendingCount, muted, toggleMute, markRead, openOrder, dismiss, refreshPending }}
    >
      {children}

      {/* Pop-up stack */}
      <div className="fixed bottom-4 right-4 z-[55] flex w-[300px] flex-col gap-3">
        {activeAlerts.map((a) => (
          <div key={a.orderId} className="overflow-hidden rounded-2xl border border-accent-soft bg-white shadow-pop">
            <div className="flex items-start justify-between gap-2 bg-accent px-4 py-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink">New order</p>
              <button
                type="button"
                onClick={() => dismiss(a.orderId)}
                aria-label="Dismiss"
                className="text-ink/60 hover:text-ink"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="font-mono text-[13px] font-semibold text-ink">{a.orderNumber}</p>
              <p className="mt-0.5 text-[12px] text-muted">
                {a.itemCount} item{a.itemCount === 1 ? "" : "s"} · {formatCurrency(a.subtotal)}
              </p>
              <button
                type="button"
                onClick={() => openOrder(a.orderId)}
                className="mt-3 w-full rounded-full bg-ink py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink-soft"
              >
                View order →
              </button>
            </div>
          </div>
        ))}
      </div>
    </AlertsContext.Provider>
  );
}

/** Bell + dropdown, rendered inside the shell header. */
export function AlertBell() {
  const { alerts, unread, muted, toggleMute, markRead, openOrder } = useOrderAlerts();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          markRead();
        }}
        aria-label={unread > 0 ? `Order alerts (${unread} unread)` : "Order alerts"}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-body transition hover:border-ink hover:text-ink"
      >
        <Icon name="bell" className="h-[17px] w-[17px]" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-[60] mt-2 w-[300px] overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <p className="text-[13px] font-semibold text-ink">Order alerts</p>
            <button
              type="button"
              onClick={toggleMute}
              className="text-[11px] font-semibold text-soft hover:text-ink"
            >
              {muted ? "Unmute chime" : "Mute chime"}
            </button>
          </div>
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">No new orders yet today.</p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto">
              {alerts.map((a) => (
                <li key={`${a.orderId}-${a.at}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openOrder(a.orderId);
                    }}
                    className="flex w-full items-center justify-between gap-3 border-b border-sand px-4 py-3 text-left last:border-0 hover:bg-paper"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[12px] font-semibold text-ink">{a.orderNumber}</p>
                      <p className="text-[11px] text-muted">
                        {a.itemCount} item{a.itemCount === 1 ? "" : "s"} · {timeAgo(a.at)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] font-semibold text-ink">
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
  );
}
