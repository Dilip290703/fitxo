"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

/**
 * Scroll-linked parallax layer. Drop it INSIDE a `relative overflow-hidden`
 * container (e.g. an image card) and pass a full-bleed `<Image fill>` as the
 * child — the image drifts vertically as the section travels through the
 * viewport, giving a subtle sense of depth that reacts continuously to scroll.
 *
 * The moving layer is inset by -8% on every side so the drift never exposes the
 * container's edges. Spring-smoothed for a soft, natural feel. No-op (static)
 * under prefers-reduced-motion.
 */
export function CxParallax({
  children,
  amount = 22,
}: {
  children: ReactNode;
  /** Peak vertical travel in px, from -amount (top) to +amount (bottom). */
  amount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const yRaw = useTransform(scrollYProgress, [0, 1], [-amount, amount]);
  const y = useSpring(yRaw, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <div ref={ref} className="absolute inset-0">
      <motion.div className="absolute inset-[-8%]" style={reduce ? undefined : { y }}>
        {children}
      </motion.div>
    </div>
  );
}
