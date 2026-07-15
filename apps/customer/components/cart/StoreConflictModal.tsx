"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { StoreConflict } from "@/lib/storeConflict";

/**
 * Single-store cart (G1): shown when the customer tries to add an item from a
 * second store. One rider serves one store, so each order is one store — the
 * modal offers the two honest ways forward (finish this bag first, or start a
 * fresh bag with the new store) plus a quiet escape.
 *
 * Entrance is transform-dominant (repo lesson 2026-07-10: never gate critical
 * content behind an opacity-only fade — paused animation clocks would hide it).
 */
export function StoreConflictModal({
  conflict,
  bagCount,
  onStartNewBag,
  onClose,
}: {
  conflict: StoreConflict | null;
  /** Items in the current bag — makes the copy concrete. */
  bagCount: number;
  onStartNewBag: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const open = conflict !== null;

  // Close on Escape + lock body scroll while open (same as LoginRequiredModal).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!conflict) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-conflict-title"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#171d2b]/45 backdrop-blur-[3px]" />

      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="fitzo-store-card relative w-full max-w-[440px] overflow-hidden rounded-[24px] border border-[#ece4da] bg-[#fbfaf7] shadow-[0_24px_70px_-20px_rgba(23,29,43,0.45)]"
      >
        {/* Decorative top band */}
        <div className="h-2 w-full bg-gradient-to-r from-[#171d2b] via-[#8b7058] to-[#c89b3c]" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-5 flex h-11 w-11 items-center justify-center rounded-full text-[#8b7058] transition hover:bg-[#f4ede4] hover:text-[#171717]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-7 pb-7 pt-6 text-center">
          {/* Icon: storefront */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#171d2b]">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 9l1-4h14l1 4M4 9v10h16V9M4 9h16M9 19v-5h6v5" />
            </svg>
          </div>

          <h2 id="store-conflict-title" className="mt-5 font-display text-[26px] leading-tight text-[#171717]">
            One order, one store
          </h2>
          <p className="mx-auto mt-2 max-w-[350px] text-[14px] leading-6 text-[#5f5851]">
            Your bag has {bagCount === 1 ? "an item" : `${bagCount} items`} from{" "}
            <strong className="text-[#171717]">{conflict.currentStoreName}</strong>. One rider
            delivers from a single store for your doorstep try-on, so{" "}
            <strong className="text-[#171717]">{conflict.newStoreName}</strong> needs its own
            order.
          </p>

          {/* Primary: start fresh with the new store */}
          <button
            type="button"
            onClick={onStartNewBag}
            className="mt-6 w-full rounded-[14px] bg-[#171d2b] px-5 py-3.5 text-[14px] font-semibold text-white transition hover:bg-[#2a3345]"
          >
            Start a new bag with {conflict.newStoreName}
          </button>

          {/* Secondary: place the current order first (the true "2 orders" path) */}
          <button
            type="button"
            onClick={() => {
              // Close BEFORE navigating — provider-mounted modals survive
              // client route changes (LoginRequiredModal lesson).
              onClose();
              router.push("/checkout");
            }}
            className="mt-2 w-full rounded-[14px] border border-[#ddd4c9] bg-white px-5 py-3.5 text-[14px] font-semibold text-[#171717] transition hover:border-[#171d2b]"
          >
            Checkout my {conflict.currentStoreName} bag first
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-[14px] px-5 py-3 text-[13px] font-medium text-[#8b7058] transition hover:text-[#171717]"
          >
            Keep my current bag
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fitzo-store-pop {
          0%   { transform: translateY(14px) scale(0.96) }
          100% { transform: translateY(0) scale(1) }
        }
        .fitzo-store-card { animation: fitzo-store-pop 240ms cubic-bezier(0.18,0.89,0.32,1.2) both }
        @media (prefers-reduced-motion: reduce) {
          .fitzo-store-card { animation: none }
        }
      `}</style>
    </div>
  );
}
