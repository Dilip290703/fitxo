"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAvailableJobs, riderClaim, type AvailableJob } from "@/lib/deliveries";
import { useAgent } from "@/components/AgentShell";

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

function areaOf(a: AvailableJob["dropAddress"]) {
  return [a.city, a.pincode].filter(Boolean).join(" · ") || "Address on accept";
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
        const jobs = await fetchAvailableJobs();
        if (!active) return;
        setError(null);
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
        <div className="pointer-events-auto rounded-full bg-[#3a2020] px-4 py-2 text-[12px] font-medium text-[#ffb4a2] shadow-lg">
          {error}
        </div>
      ) : null}

      {offers.slice(0, 2).map((job) => (
        <div
          key={job.deliveryId}
          className="pointer-events-auto w-full max-w-[380px] overflow-hidden rounded-2xl border border-[#3b82f6]/50 bg-[#131a28] shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-center justify-between bg-[#3b82f6] px-4 py-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">
              🛵 New delivery offer
            </p>
            <button
              type="button"
              onClick={toggleMute}
              className="text-[11px] font-semibold text-white/85 hover:text-white"
            >
              {muted ? "🔇" : "🔔"}
            </button>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[13px] font-semibold text-white">{job.orderNumber}</p>
              <p className="text-[13px] font-semibold text-[#7fe0b0]">
                +{formatCurrency(job.deliveryFee)}
              </p>
            </div>
            <p className="mt-1 text-[12px] text-[#9fb0cc]">
              {job.itemCount} item{job.itemCount === 1 ? "" : "s"} · {areaOf(job.dropAddress)}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => decline(job.deliveryId)}
                disabled={claiming === job.deliveryId}
                className="flex-1 rounded-full border border-[#33405a] py-2.5 text-[12px] font-semibold text-[#9fb0cc] transition hover:bg-white/5"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => accept(job)}
                disabled={claiming === job.deliveryId}
                className="flex-[2] rounded-full bg-[#3b82f6] py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#2f6fe0] disabled:opacity-60"
              >
                {claiming === job.deliveryId ? "Accepting…" : "Accept"}
              </button>
            </div>
          </div>
        </div>
      ))}

      {offers.length > 2 ? (
        <p className="pointer-events-auto text-[11px] font-medium text-[#7c8aa5]">
          +{offers.length - 2} more offer{offers.length - 2 === 1 ? "" : "s"} waiting
        </p>
      ) : null}
    </div>
  );
}
