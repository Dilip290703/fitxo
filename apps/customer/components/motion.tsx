"use client";

/**
 * Shared motion primitives for the customer panel.
 *
 * One vocabulary everywhere: the same easing curve the CSS hero stagger
 * uses (cubic-bezier(0.22,1,0.36,1)), enter durations in the 0.5–0.7s
 * editorial range, exits faster than enters, and every primitive collapses
 * to a plain fade (or nothing) under prefers-reduced-motion.
 */

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";
import type { ReactNode } from "react";

/** The house easing — matches the hero's CSS curve so motion feels like one system. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  micro: 0.2,
  enter: 0.6,
  exit: 0.35,
} as const;

/** Soft spring for overlays/sheets — settles without wobble. */
export const SPRING_SOFT = {
  type: "spring",
  stiffness: 260,
  damping: 30,
} as const;

/**
 * Overlay pattern: overlays stay MOUNTED and animate between "open"/"closed"
 * via these variants (never AnimatePresence exit-unmount — broken in this
 * stack: exits complete but nodes are never removed, leaving invisible
 * click-blockers). Pair with `inert={!isOpen}` + a pointer-events class so
 * the closed overlay can't trap clicks or focus.
 */
export const backdropVariants: Variants = {
  open: {
    opacity: 1,
    transition: { duration: 0.3, ease: EASE },
  },
  closed: {
    opacity: 0,
    transition: { duration: 0.2, ease: EASE },
  },
};

export function panelVariants(reduce: boolean | null): Variants {
  return {
    open: reduce
      ? { opacity: 1, transition: { duration: 0.25 } }
      : { opacity: 1, y: 0, scale: 1, transition: SPRING_SOFT },
    closed: reduce
      ? { opacity: 0, transition: { duration: 0.15 } }
      : {
          opacity: 0,
          y: 24,
          scale: 0.97,
          transition: { duration: 0.2, ease: EASE },
        },
  };
}

const riseVariants: Variants = {
  hidden: { opacity: 0, y: 26 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.enter, ease: EASE },
  },
};

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.enter, ease: EASE } },
};

/**
 * Scroll-triggered reveal: rises + fades in once, when ~30% visible.
 * Reduced motion → opacity-only.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  amount = 0.3,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Portion of the element that must be visible before it animates. */
  amount?: number;
} & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={reduce ? fadeVariants : riseVariants}
      transition={{ duration: DURATION.enter, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered group — children wrapped in <StaggerItem> cascade in at 70ms
 * intervals when the group scrolls into view.
 */
export function StaggerGroup({
  children,
  className,
  amount = 0.2,
  stagger = 0.07,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
  stagger?: number;
} & HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={reduce ? fadeVariants : riseVariants}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
