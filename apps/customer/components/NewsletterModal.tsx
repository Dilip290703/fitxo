"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/motion";

type NewsletterModalProps = {
  isOpen: boolean;
  message: string;
  onClose: () => void;
};

function CheckGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function NewsletterModal({
  isOpen,
  message,
  onClose,
}: NewsletterModalProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={false}
      animate={isOpen ? "open" : "closed"}
      variants={{
        open: reduce
          ? { opacity: 1, transition: { duration: 0.2 } }
          : {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: "spring", stiffness: 300, damping: 26 },
            },
        closed: reduce
          ? { opacity: 0, transition: { duration: 0.15 } }
          : { opacity: 0, y: 24, scale: 0.97, transition: { duration: 0.2, ease: EASE } },
      }}
      inert={!isOpen}
      className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-[20px] border border-[#e6dac8] bg-white px-5 py-4 shadow-[0_18px_40px_rgba(26,22,18,0.14)] ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#a48d78] text-white">
          <CheckGlyph />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#a48d78]">
            FitZo update
          </p>
          <p className="mt-2 text-[14px] leading-6 text-[#221b13]">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-[#6f6050] transition duration-200 hover:bg-[#f4f1ea] hover:text-[#221b13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/50"
          aria-label="Close newsletter toast"
        >
          <CloseGlyph />
        </button>
      </div>
    </motion.div>
  );
}
