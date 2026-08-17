"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { backdropVariants, EASE, panelVariants } from "@/components/motion";

type DeliveryFlowModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const flowSteps = [
  "Pick styles from nearby stores",
  "Book a delivery slot that suits you",
  "Try everything on while the rider waits",
  "Keep what you love, hand the rest back on the spot",
];

function CloseGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
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

export function DeliveryFlowModal({
  isOpen,
  onClose,
}: DeliveryFlowModalProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <motion.div
      initial={false}
      animate={isOpen ? "open" : "closed"}
      variants={backdropVariants}
      inert={!isOpen}
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="How Fitxo delivery works"
        variants={panelVariants(reduce)}
        className="w-full max-w-2xl rounded-[30px] bg-[#faf9f6] p-8 shadow-[0_35px_80px_rgba(20,20,20,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#a48d78]">
              Delivery flow
            </p>
            <h2 className="mt-3 font-display text-[38px] leading-none text-[#221b13]">
              How FitXo brings the fitting room to your door.
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2.5 text-[#6f6050] transition duration-200 hover:bg-[#f4f1ea] hover:text-[#221b13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/50"
            aria-label="Close delivery flow modal"
          >
            <CloseGlyph />
          </button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {flowSteps.map((step, index) => (
            <motion.div
              key={step}
              variants={{
                open: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.45,
                    ease: EASE,
                    delay: 0.12 + index * 0.07,
                  },
                },
                closed: reduce
                  ? { opacity: 0, transition: { duration: 0.1 } }
                  : { opacity: 0, y: 14, transition: { duration: 0.15 } },
              }}
              className="rounded-[20px] border border-[#e6dac8] bg-white px-5 py-5"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#a48d78]">
                Step 0{index + 1}
              </p>
              <p className="mt-3 text-[16px] leading-7 text-[#221b13]">{step}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
