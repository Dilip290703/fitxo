'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';
import { Icon } from '@/components/admin/icons';

type AlertItem = {
  orderId: string;
  orderNumber: string;
  amount: number;
  at: number;
};

const MUTE_KEY = 'fitzo-admin-alerts-muted';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function timeAgo(at: number) {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return 'just now';
  return `${Math.round(s / 60)}m ago`;
}

/**
 * Live new-order alerts for admins. Subscribes to `orders` INSERTs (admin RLS
 * sees all). Pop-up stack + bell history + chime, no polling.
 */
export default function OrderAlerts() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  const mutedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const playChime = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = audioRef.current;
    if (!ctx || ctx.state !== 'running') return;
    [0, 0.16].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
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
    setMuted(typeof window !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1');

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
    window.addEventListener('pointerdown', unlock, { once: true });

    const supabase = createClient();
    const channel = supabase
      .channel('admin-new-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          if (!row?.id) return;
          pushAlert({
            orderId: row.id,
            orderNumber: row.order_number ?? row.id,
            amount: Number(row.final_amount ?? 0),
            at: Date.now(),
          });
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener('pointerdown', unlock);
      supabase.removeChannel(channel);
    };
  }, [pushAlert]);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const openOrder = (orderId: string) => {
    setActiveIds((prev) => prev.filter((id) => id !== orderId));
    setBellOpen(false);
    router.push(`/admin/orders/${orderId}`);
  };

  const dismiss = (orderId: string) =>
    setActiveIds((prev) => prev.filter((id) => id !== orderId));

  const activeAlerts = activeIds
    .map((id) => alerts.find((a) => a.orderId === id))
    .filter((a): a is AlertItem => Boolean(a));

  return (
    <>
      {/* Bell (inline — lives in the header row next to name/logout) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setBellOpen((o) => !o);
            setUnread(0);
          }}
          aria-label="Order alerts"
          className="relative grid h-8 w-8 place-items-center rounded-lg border border-line bg-white text-ink hover:border-line-strong"
        >
          <Icon name="notifications" className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>

        {bellOpen ? (
          <div className="absolute right-0 mt-2 z-[60] w-[300px] overflow-hidden rounded-xl border border-line bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-[13px] font-semibold text-ink">Order alerts</p>
              <button
                type="button"
                onClick={toggleMute}
                className="text-[11px] font-semibold text-soft hover:text-ink"
              >
                {muted ? '🔇 Unmute' : '🔔 Mute'}
              </button>
            </div>
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted">No new orders yet.</p>
            ) : (
              <ul className="max-h-[320px] overflow-y-auto">
                {alerts.map((a) => (
                  <li key={`${a.orderId}-${a.at}`}>
                    <button
                      type="button"
                      onClick={() => openOrder(a.orderId)}
                      className="flex w-full items-center justify-between gap-3 border-b border-line/60 px-4 py-3 text-left last:border-0 hover:bg-cream"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[12px] font-semibold text-info">
                          {a.orderNumber}
                        </p>
                        <p className="text-[11px] text-muted">{timeAgo(a.at)}</p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold text-body">
                        {formatCurrency(a.amount)}
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
            className="overflow-hidden rounded-xl border border-ink/40 bg-white shadow-pop"
          >
            <div className="flex items-start justify-between gap-2 bg-ink px-4 py-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
                🛒 New order
              </p>
              <button
                type="button"
                onClick={() => dismiss(a.orderId)}
                aria-label="Dismiss"
                className="text-[14px] leading-none text-ink/70 hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="font-mono text-[13px] font-semibold text-ink">{a.orderNumber}</p>
              <p className="mt-0.5 text-[12px] text-soft">{formatCurrency(a.amount)}</p>
              <button
                type="button"
                onClick={() => openOrder(a.orderId)}
                className="mt-3 w-full rounded-lg bg-ink py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-ink-soft"
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
