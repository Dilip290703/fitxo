"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAvailableJobs, riderClaim, riderDecline, type AvailableJob } from "@/lib/deliveries";
import { useAgent } from "@/components/AgentShell";
import { IconBell, IconBellOff, IconScooter } from "@/components/icons";

const POLL_MS = 7000; // how often we refresh the offer feed while online
const RING_MS = 3500; // gap between repeat chimes while an offer is pending
const MUTE_KEY = "fitzo-agent-offers-muted";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function areaOf(a: AvailableJob["dropArea"]) {
  return [a.landmark, a.city, a.pincode].filter(Boolean).join(" · ") || "Area on accept";
}

/** "just now" / "waiting 4 min" — how long the order has been waiting for a rider. */
function waitingLabel(createdAt: string, now: number) {
  const m = Math.floor((now - new Date(createdAt).getTime()) / 60000);
  if (!Number.isFinite(m) || m < 1) return "just now";
  return `waiting ${m} min`;
}

/**
 * Driver-app style incoming-order offers. While the rider is Online, we poll the
 * self-serve feed (available_deliveries RPC, migration 024) and surface every
 * unclaimed job as an Accept/Decline card with a REPEATING alert chime until the
 * rider acts. Accept claims the job atomically (first rider wins); Decline hides
 * it for this session. Polling (not join-RLS realtime) keeps this dead reliable.
 */
export function IncomingJobsProvider() {
  const router = useRouter();
  const { available, rider } = useAgent();

  const [offers, setOffers] = useState<AvailableJob[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismissedRef = useRef<Set<string>>(new Set());
  const mutedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const playChime = useCallback(() => {
    if (mutedRef.current) return;
    // Vibrate too — audio needs a tap-to-unlock and dies in a pocket (audit M2).
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      /* unsupported */
    }
    const ctx = audioRef.current;
    if (!ctx || ctx.state !== "running") return;
    // Three urgent rising notes — a "new order" ring.
    [0, 0.18, 0.36].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = [700, 900, 1100][i];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.22);
    });
  }, []);

  // Unlock audio + read mute preference once.
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
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Poll the offer feed while online.
  useEffect(() => {
    if (!available) {
      setOffers([]);
      return;
    }
    let active = true;
    const poll = async () => {
      try {
        const { jobs, error: fetchError } = await fetchAvailableJobs();
        if (!active) return;
        setError(fetchError);
        setOffers(jobs.filter((j) => !dismissedRef.current.has(j.deliveryId)));
      } catch {
        /* keep last offers on a transient failure */
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [available, rider.riderId]);

  // Repeat the chime while there's a pending offer.
  useEffect(() => {
    if (!available || offers.length === 0) return;
    playChime();
    const id = setInterval(playChime, RING_MS);
    return () => clearInterval(id);
  }, [available, offers.length, playChime]);

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

  const decline = (deliveryId: string) => {
    dismissedRef.current.add(deliveryId);
    setOffers((prev) => prev.filter((o) => o.deliveryId !== deliveryId));
    // Persist the decline so it won't re-offer to this rider for the cooldown
    // window (survives refresh / re-poll). Fire-and-forget.
    void riderDecline(deliveryId);
  };

  const accept = async (job: AvailableJob) => {
    setClaiming(job.deliveryId);
    setError(null);
    const { error: claimError } = await riderClaim(job.deliveryId);
    setClaiming(null);
    if (claimError) {
      // Someone else grabbed it (or it moved on) — drop it and inform the rider.
      dismissedRef.current.add(job.deliveryId);
      setOffers((prev) => prev.filter((o) => o.deliveryId !== job.deliveryId));
      setError(claimError.message || "That job was just taken.");
      setTimeout(() => setError(null), 4000);
      return;
    }
    setOffers((prev) => prev.filter((o) => o.deliveryId !== job.deliveryId));
    router.push(`/deliveries/${job.deliveryId}`);
  };

  if (!available) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-3 px-4 lg:bottom-6">
      {error ? (
        <div className="pointer-events-auto rounded-full border border-danger-line bg-danger-bg px-4 py-2 text-[13px] font-medium text-danger shadow-float">
          {error}
        </div>
      ) : offers.length === 0 ? (
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-success-line bg-white px-4 py-2 text-[13px] font-medium text-success shadow-float">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
          Online · waiting for orders…
        </div>
      ) : null}

      {offers.slice(0, 2).map((job) => (
        <div
          key={job.deliveryId}
          className="pointer-events-auto w-full max-w-[380px] overflow-hidden rounded-2xl border border-ink bg-white shadow-pop"
        >
          <div className="flex items-center justify-between bg-ink px-4 py-2.5">
            <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
              <IconScooter size={16} /> New delivery offer
            </p>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute offer alerts" : "Mute offer alerts"}
              className="grid h-8 w-8 place-items-center rounded-full text-white/80 hover:text-white"
            >
              {muted ? <IconBellOff size={16} /> : <IconBell size={16} />}
            </button>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[14px] font-semibold text-ink">{job.orderNumber}</p>
              <p className="text-[18px] font-bold text-success">
                +{formatCurrency(job.deliveryFee)}
              </p>
            </div>
            <div className="mt-2 space-y-1 text-[13px]">
              <p className="flex gap-1.5 text-ink">
                <span className="w-11 shrink-0 font-semibold uppercase text-[11px] leading-5 tracking-wide text-muted">Pickup</span>
                <span className="min-w-0 font-medium">
                  {job.storeName ?? "Store on accept"}
                  {job.storeCount > 1 ? ` +${job.storeCount - 1} more` : ""}
                  {job.storeArea ? <span className="font-normal text-body"> · {job.storeArea}</span> : null}
                </span>
              </p>
              <p className="flex gap-1.5 text-ink">
                <span className="w-11 shrink-0 font-semibold uppercase text-[11px] leading-5 tracking-wide text-muted">Drop</span>
                <span className="min-w-0 font-medium">{areaOf(job.dropArea)}</span>
              </p>
            </div>
            <p className="mt-1.5 text-[12px] text-soft">
              {job.itemCount} item{job.itemCount === 1 ? "" : "s"} · {waitingLabel(job.createdAt, Date.now())}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => decline(job.deliveryId)}
                disabled={claiming === job.deliveryId}
                className="h-12 flex-1 rounded-2xl border border-line-strong text-[14px] font-semibold text-body transition hover:bg-cream"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => accept(job)}
                disabled={claiming === job.deliveryId}
                className="h-12 flex-[2] rounded-2xl bg-ink text-[14px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-ink-soft disabled:opacity-60"
              >
                {claiming === job.deliveryId ? "Accepting…" : "Accept"}
              </button>
            </div>
          </div>
        </div>
      ))}

      {offers.length > 2 ? (
        <p className="pointer-events-auto rounded-full bg-white px-3 py-1 text-[12px] font-medium text-soft shadow-float">
          +{offers.length - 2} more offer{offers.length - 2 === 1 ? "" : "s"} waiting
        </p>
      ) : null}
    </div>
  );
}
