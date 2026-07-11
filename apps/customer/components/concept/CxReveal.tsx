"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Scroll-triggered reveal for the concept page. Rises + fades in once, when
 * ~15% visible. Plays in a real browser; collapses to instant under
 * prefers-reduced-motion so content is never gated on the animation.
 */
export function CxReveal({
  children,
  className,
  delay = 0,
  y = 26,
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
      initial={reduce ? { opacity: 1 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered reveal group — children wrapped in <CxRiseChild> cascade in.
 */
export function CxRevealGroup({
  children,
  className,
  stagger = 0.08,
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
          ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
          : {
              hidden: { opacity: 0, y: 28 },
              show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
            }
      }
    >
      {children}
    </motion.div>
  );
}
