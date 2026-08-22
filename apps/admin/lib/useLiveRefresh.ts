'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keep a server-rendered admin screen live without a manual reload.
 *
 * WHY THIS AND NOT REALTIME (audit §2.4, same call as the store fix in PR #66):
 * a poll is the reliable core, Realtime the latency optimization — the standing
 * rule since 2026-06-28. A poll also catches changes that emit no notification
 * and no row event the client subscribes to: the rider marking a delivery
 * done, the try-window cron completing an order, a store confirming. A
 * notification-driven refresh structurally cannot see those.
 *
 * These screens are server components that pass rows down as props, so the
 * refresh mechanism is `router.refresh()` — it re-runs the server component and
 * streams new props in. Client state (filters, search, selection, an open
 * dialog, a half-typed cancellation reason) survives it, because React
 * reconciles rather than remounts.
 *
 * @param paused  true while a write is in flight. A tick landing mid-write
 *                would repaint the row the admin just acted on with pre-write
 *                server state — the same guard the store's detail screen needs
 *                around its optimistic writes.
 */
export function useLiveRefresh({
  paused = false,
  intervalMs = 4000,
}: { paused?: boolean; intervalMs?: number } = {}) {
  const router = useRouter();

  // `paused` is read at tick time through a ref rather than named as a
  // dependency on purpose: as a dependency, every write toggling the busy flag
  // would tear the interval down and build a new one, resetting its phase. A
  // screen with frequent short writes could then go a long time without ever
  // completing a 4s cycle. One stable timer, a mutable answer.
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const tick = () => {
      // A backgrounded tab must not hold a standing query every 4s.
      if (document.visibilityState !== 'visible') return;
      if (pausedRef.current) return;
      router.refresh();
    };

    const id = setInterval(tick, intervalMs);
    // Coming back to the tab should not cost up to a full interval of staleness.
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', tick);
    };
  }, [router, intervalMs]);
}
