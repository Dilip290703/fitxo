"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LoginRequiredModal({
  open,
  onClose,
  message = "Log in or create an account to place your try-at-home order. Your bag is saved — you'll come right back to it.",
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  const router = useRouter();

  // Close on Escape + lock body scroll while open.
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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ animation: "fitxo-fade-in 180ms ease-out both" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#171d2b]/45 backdrop-blur-[3px]" />

      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] overflow-hidden rounded-[24px] border border-[#ece4da] bg-[#fbfaf7] shadow-[0_24px_70px_-20px_rgba(23,29,43,0.45)]"
        style={{ animation: "fitxo-pop-in 260ms cubic-bezier(0.18,0.89,0.32,1.28) both" }}
      >
        {/* Decorative top band */}
        <div className="h-2 w-full bg-gradient-to-r from-[#171d2b] via-[#8b7058] to-[#c89b3c]" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-5 flex h-8 w-8 items-center justify-center rounded-full text-[#8b7058] transition hover:bg-[#f4ede4] hover:text-[#171717]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-7 pb-7 pt-6 text-center">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#171d2b]">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0m12 9a8 8 0 10-16 0" />
              <circle cx="12" cy="8" r="3" />
            </svg>
          </div>

          <h2 id="login-modal-title" className="mt-5 font-display text-[26px] leading-tight text-[#171717]">
            One step before you order
          </h2>
          <p className="mx-auto mt-2 max-w-[320px] text-[14px] leading-6 text-[#5f5851]">
            {message}
          </p>

          <button
            type="button"
            onClick={() => {
              // Close BEFORE navigating — this modal is rendered by providers
              // that live in the root layout, so it survives the client-side
              // route change and would keep covering the /login page.
              onClose();
              router.push("/login");
            }}
            className="mt-6 w-full rounded-[14px] bg-[#171d2b] px-5 py-3.5 text-[14px] font-semibold text-white transition hover:bg-[#2a3345]"
          >
            Log in / Sign up
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-[14px] px-5 py-3 text-[13px] font-medium text-[#8b7058] transition hover:text-[#171717]"
          >
            Keep browsing
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fitxo-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fitxo-pop-in {
          0%   { opacity: 0; transform: translateY(12px) scale(0.96) }
          100% { opacity: 1; transform: translateY(0) scale(1) }
        }
      `}</style>
    </div>
  );
}
