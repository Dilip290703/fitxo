"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";

/**
 * Thin brand-colour bar pinned to the very top of the page that fills left→right
 * as the visitor scrolls the document. Spring-smoothed so it eases rather than
 * tracking scroll 1:1. A continuous "you're making progress" cue that keeps the
 * page feeling alive on every scroll. Hidden entirely under reduced-motion.
 */
export function CxScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-[#b0703f]"
    />
  );
}
