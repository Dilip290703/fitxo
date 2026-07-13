"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Scroll-triggered reveals for the landing page.
 *
 * HARD RULE: transform-only — never animate opacity here. Content must be
 * fully visible even if the animation clock never advances (stalled rAF,
 * throttled tabs, embedded webviews). The rise/scale is pure enhancement;
 * nothing is ever gated on it. Collapses to static under
 * prefers-reduced-motion.
 */
export function CxReveal({
  children,
  className,
  delay = 0,
  y = 36,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
} & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { y }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered reveal group — children wrapped in <CxRiseChild> cascade in
 * one-by-one as the group scrolls into view.
 */
export function CxRevealGroup({
  children,
  className,
  stagger = 0.1,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function CxRiseChild({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={
        reduce
          ? {}
          : {
              hidden: { y: 44, scale: 0.97 },
              show: {
                y: 0,
                scale: 1,
                transition: { type: "spring", stiffness: 110, damping: 18, mass: 0.9 },
              },
            }
      }
    >
      {children}
    </motion.div>
  );
}
