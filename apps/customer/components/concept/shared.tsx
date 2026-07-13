import type { FrontendProduct } from "@/lib/supabase/products";

/** A product shaped for the concept sections (subset of the live catalog row). */
export type ConceptProduct = FrontendProduct;

export const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80";

export function inr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Minimal stroke-icon set matching the ARLUNE line style (1.5px). */
export function CxIcon({ path, className = "h-5 w-5" }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export const CX_ICONS = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  user: "M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  heart: "M12 20s-7-4.6-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.4 12 20 12 20z",
  bag: "M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2",
  chevron: "M6 9l6 6 6-6",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  arrowLeft: "M19 12H5m6 6-6-6 6-6",
  close: "M6 6l12 12M18 6L6 18",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  check: "M5 13l4 4 10-10",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  swap: "M7 4v13m0 0l-3-3m3 3l3-3M17 20V7m0 0l3 3m-3-3l-3 3",
};

/** ARLUNE accent tan — used for buttons, marquee, active states. */
export const CX = {
  accent: "#b0703f",
  accentDark: "#98602f",
  ink: "#1a1a1a",
  sub: "#6b6b6b",
  card: "#f0eeeb",
  line: "#e7e4df",
};
