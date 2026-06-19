"use client";

import { useEffect, useMemo } from "react";

const COLORS = ["#171d2b", "#c89b3c", "#e6c200", "#2e7d52", "#c0392b", "#8b7058", "#ffffff"];

type Piece = {
  tx: number; // horizontal burst distance (px)
  ty: number; // vertical burst distance (px, negative = up)
  rot: number; // final rotation (deg)
  delay: number; // s
  duration: number; // s
  size: number; // px
  color: string;
  round: boolean;
};

/**
 * Full-screen "cracker burst" celebration shown when an order is placed.
 * Pieces shoot outward from the centre and fall under gravity, while a
 * success badge scales in. Calls onComplete after the show so the caller
 * can redirect.
 */
export function CelebrationOverlay({
  show,
  onComplete,
  message = "Order placed!",
  subMessage = "Taking you to your order…",
}: {
  show: boolean;
  onComplete: () => void;
  message?: string;
  subMessage?: string;
}) {
  // Generate the burst once.
  const pieces = useMemo<Piece[]>(() => {
    const count = 90;
    return Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 320;
      return {
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - 80, // bias upward for a "pop" feel
        rot: (Math.random() - 0.5) * 720,
        delay: Math.random() * 0.12,
        duration: 1.1 + Math.random() * 0.9,
        size: 7 + Math.random() * 9,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() > 0.5,
      };
    });
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onComplete, 1850);
    return () => clearTimeout(t);
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-[#fbfaf7]/80 backdrop-blur-[2px]"
      style={{ animation: "fitzo-fade-in 200ms ease-out both" }}
      aria-live="polite"
    >
      {/* Confetti burst origin (centre) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2">
        {pieces.map((p, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              width: p.size,
              height: p.round ? p.size : p.size * 0.5,
              background: p.color,
              borderRadius: p.round ? "9999px" : "2px",
              // CSS vars consumed by the keyframe
              ["--tx" as string]: `${p.tx}px`,
              ["--ty" as string]: `${p.ty}px`,
              ["--rot" as string]: `${p.rot}deg`,
              animation: `fitzo-burst ${p.duration}s cubic-bezier(0.18,0.7,0.3,1) ${p.delay}s both`,
            }}
          />
        ))}
      </div>

      {/* Success badge */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full bg-[#2e7d52] shadow-[0_18px_50px_-12px_rgba(46,125,82,0.6)]"
          style={{ animation: "fitzo-badge-pop 520ms cubic-bezier(0.18,0.89,0.32,1.28) both" }}
        >
          <svg
            className="h-12 w-12 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            style={{ animation: "fitzo-check-draw 600ms ease-out 220ms both" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2
          className="mt-6 font-display text-[34px] leading-tight text-[#171717]"
          style={{ animation: "fitzo-rise 420ms ease-out 200ms both" }}
        >
          {message}
        </h2>
        <p
          className="mt-1 text-[14px] text-[#8b7058]"
          style={{ animation: "fitzo-rise 420ms ease-out 320ms both" }}
        >
          {subMessage}
        </p>
      </div>

      <style>{`
        @keyframes fitzo-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fitzo-burst {
          0%   { transform: translate(0,0) rotate(0deg); opacity: 1 }
          70%  { opacity: 1 }
          100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)); opacity: 0 }
        }
        @keyframes fitzo-badge-pop {
          0%   { transform: scale(0); opacity: 0 }
          60%  { transform: scale(1.12) }
          100% { transform: scale(1); opacity: 1 }
        }
        @keyframes fitzo-check-draw {
          from { stroke-dasharray: 30; stroke-dashoffset: 30 }
          to   { stroke-dasharray: 30; stroke-dashoffset: 0 }
        }
        @keyframes fitzo-rise {
          from { opacity: 0; transform: translateY(10px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  );
}
