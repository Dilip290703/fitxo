"use client";

/**
 * Gentle page-enter fade on every route change. Opacity only — a transform
 * here would re-anchor the sticky navbar and fixed overlays (transformed
 * ancestors become their containing block).
 */

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE } from "@/components/motion";

export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
