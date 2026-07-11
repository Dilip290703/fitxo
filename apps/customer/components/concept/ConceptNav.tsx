"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { CxIcon, CX_ICONS, type ConceptProduct } from "@/components/concept/shared";

/**
 * ARLUNE-style top chrome for the FITZO concept: announcement bar + header
 * with hover dropdowns on every shopping nav item. FITZO content, ARLUNE look.
 */

const CATEGORIES = ["Fancy Top", "Jacket", "Jeans", "Shorts", "Shirts", "Sweaters", "T-Shirts", "Footwear"];

type NavItem = {
  key: string;
  label: string;
  panel?: "shop" | "men" | "women" | "list";
  links?: string[];
  href?: string;
};

const NAV: NavItem[] = [
  { key: "shop", label: "Shop", panel: "shop" },
  { key: "men", label: "Men", panel: "men" },
  { key: "women", label: "Women", panel: "women" },
  { key: "collections", label: "Collections", panel: "list", links: ["New In", "Best Sellers", "Traditional Collection", "Sale"] },
  { key: "try", label: "Try at Home", panel: "list", links: ["How it works", "Book a slot", "Track your order", "Returns"] },
  { key: "journal", label: "Journal", href: "#journal" },
];

const SOCIALS: { label: string; path: string; filled?: boolean }[] = [
  { label: "Facebook", path: "M13.5 21v-8h2.6l.4-3h-3V8.1c0-.9.3-1.5 1.6-1.5H16.6V4c-.3 0-1.3-.1-2.4-.1-2.3 0-3.9 1.4-3.9 4V10H7.7v3h2.6v8h3.2z", filled: true },
  { label: "Pinterest", path: "M12 3a9 9 0 0 0-3.3 17.4c-.1-.7-.1-1.9.02-2.7l1-4.2s-.25-.5-.25-1.3c0-1.2.7-2.1 1.6-2.1.75 0 1.1.56 1.1 1.24 0 .76-.48 1.9-.73 2.95-.2.88.44 1.6 1.3 1.6 1.57 0 2.77-1.65 2.77-4.03 0-2.1-1.5-3.58-3.66-3.58a3.8 3.8 0 0 0-3.96 3.8c0 .75.3 1.55.66 2 .07.08.08.16.06.24l-.24 1c-.04.16-.13.2-.3.12-1.1-.5-1.8-2.1-1.8-3.4 0-2.8 2-5.3 5.9-5.3 3.1 0 5.5 2.2 5.5 5.16 0 3.08-1.94 5.56-4.64 5.56-.9 0-1.76-.47-2.05-1.03l-.56 2.13c-.2.78-.75 1.75-1.12 2.34A9 9 0 1 0 12 3z", filled: true },
  { label: "Instagram", path: "M17 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zm-5 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm5-1v0" },
  { label: "YouTube", path: "M21 6s-.2-1.5-.8-2.1c-.8-.8-1.7-.8-2.1-.9C15.3 3 12 3 12 3s-3.3 0-6.1.2c-.4 0-1.3 0-2.1.9C3.2 4.6 3 6 3 6s-.2 1.7-.2 3.4v1.2C2.8 12.3 3 14 3 14s.2 1.5.8 2.1c.8.8 1.9.8 2.4.9 1.7.2 5.8.2 5.8.2s3.3 0 6.1-.2c.4 0 1.3 0 2.1-.9.6-.6.8-2.1.8-2.1s.2-1.7.2-3.4V9.4C21.2 7.7 21 6 21 6zM10 14V8l5 3-5 3z", filled: true },
  { label: "TikTok", path: "M14.2 4c.4 1.8 1.4 2.9 3.1 3.4v2.3c-1.1 0-2.2-.3-3.1-.9v5.4c0 2.8-1.8 4.6-4.4 4.6-2.5 0-4.3-1.8-4.3-4.2 0-2.7 2-4.4 4.9-4.3v2.2c-1.4-.1-2.4.6-2.4 1.8 0 1 .8 1.8 1.8 1.8 1.2 0 1.9-.7 1.9-2.1V4h2.5z", filled: true },
];

export function ConceptNav({ featured }: { featured: ConceptProduct[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const active = NAV.find((n) => n.key === open);

  return (
    <header className="sticky top-0 z-40 bg-white">
      {/* Announcement bar */}
      <div className="bg-[#1a1a1a] text-white">
        <div className="mx-auto flex h-11 max-w-[1400px] items-center justify-between px-5 text-[12px] lg:px-8">
          <div className="hidden items-center gap-1 md:flex">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href="#"
                aria-label={s.label}
                className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition duration-200 hover:bg-white hover:text-[#1a1a1a]"
              >
                <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill={s.filled ? "currentColor" : "none"} stroke={s.filled ? "none" : "currentColor"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d={s.path} />
                  {s.label === "Instagram" ? <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" /> : null}
                </svg>
              </a>
            ))}
          </div>
          <p className="mx-auto text-center tracking-wide md:mx-0">
            Rider waits at your door — <span className="font-semibold">try before you buy.</span>{" "}
            <Link href="/products" className="underline underline-offset-2">Shop now</Link>
          </p>
          <div className="hidden items-center gap-4 md:flex">
            <span className="flex items-center gap-1.5">🇮🇳 India (INR ₹)</span>
            <span className="flex items-center gap-1">English <CxIcon path={CX_ICONS.chevron} className="h-3.5 w-3.5" /></span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="relative border-b border-[#eee]" onMouseLeave={() => setOpen(null)}>
        <div className="mx-auto flex h-[70px] max-w-[1400px] items-center justify-between px-5 lg:px-8">
          <Link href="/concept" className="font-sans text-[26px] font-bold tracking-[0.28em] text-[#1a1a1a]">FITZO</Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {NAV.map((item) => (
              <div key={item.key} onMouseEnter={() => setOpen(item.panel ? item.key : null)} className="group relative">
                {item.href ? (
                  <Link href={item.href} className="flex items-center gap-1 py-6 text-[15px] text-[#333] transition group-hover:text-[#b0703f]">
                    {item.label}
                  </Link>
                ) : (
                  <button className="flex items-center gap-1 py-6 text-[15px] text-[#333] transition group-hover:text-[#b0703f]">
                    {item.label}
                    <CxIcon path={CX_ICONS.chevron} className={`h-3.5 w-3.5 transition-transform duration-200 ${open === item.key ? "rotate-180" : ""}`} />
                  </button>
                )}
                <span className={`pointer-events-none absolute inset-x-0 bottom-4 mx-auto h-[2px] bg-[#b0703f] transition-all duration-300 ${open === item.key ? "w-full" : "w-0 group-hover:w-full"}`} />
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-5 text-[#1a1a1a]">
            <button aria-label="Search" className="transition hover:text-[#b0703f]"><CxIcon path={CX_ICONS.search} /></button>
            <button aria-label="Account" className="transition hover:text-[#b0703f]"><CxIcon path={CX_ICONS.user} /></button>
            <button aria-label="Wishlist" className="relative transition hover:text-[#b0703f]">
              <CxIcon path={CX_ICONS.heart} />
              <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-[#b0703f] text-[9px] font-semibold text-white">0</span>
            </button>
            <button aria-label="Cart" className="relative flex items-center gap-1.5 transition hover:text-[#b0703f]">
              <CxIcon path={CX_ICONS.bag} />
              <span className="hidden text-[14px] sm:inline">Cart</span>
              <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-[#b0703f] text-[9px] font-semibold text-white">0</span>
            </button>
          </div>
        </div>

        {/* Dropdown panel */}
        <div
          className={`absolute inset-x-0 top-full origin-top border-b border-[#eee] bg-white shadow-[0_24px_50px_-24px_rgba(0,0,0,0.18)] transition-all duration-300 ${
            active ? "pointer-events-auto opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
          }`}
          onMouseEnter={() => active && setOpen(active.key)}
        >
          <div className="mx-auto max-w-[1400px] px-8 py-8">
            {active?.panel === "shop" ? (
              <div className="grid grid-cols-[1fr_1.4fr] gap-10">
                <MenuColumn title="Shop by category" cols={2} links={CATEGORIES} />
                <div>
                  <ColTitle>Featured</ColTitle>
                  <div className="grid grid-cols-2 gap-4">
                    {featured.slice(0, 2).map((p) => <FeaturedCard key={p.id} product={p} />)}
                  </div>
                </div>
              </div>
            ) : active?.panel === "men" || active?.panel === "women" ? (
              <div className="grid grid-cols-[1fr_1.6fr] gap-10">
                <MenuColumn title={active.label} cols={1} links={CATEGORIES.slice(0, 6)} />
                <div className="grid grid-cols-3 gap-4">
                  {featured.slice(0, 3).map((p) => <FeaturedCard key={p.id} product={p} big />)}
                </div>
              </div>
            ) : active?.panel === "list" ? (
              <MenuColumn title={active.label} cols={2} links={active.links ?? []} />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function ColTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-4 border-b border-[#1a1a1a] pb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#1a1a1a]">{children}</h4>;
}

function MenuColumn({ title, links, cols }: { title: string; links: string[]; cols: 1 | 2 }) {
  return (
    <div>
      <ColTitle>{title}</ColTitle>
      <ul className={`grid gap-y-2.5 text-[14px] text-[#555] ${cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {links.map((c) => (
          <li key={c}><Link href="/products" className="transition hover:text-[#b0703f]">{c}</Link></li>
        ))}
      </ul>
    </div>
  );
}

function FeaturedCard({ product, big }: { product: ConceptProduct; big?: boolean }) {
  return (
    <Link href="/products" className="group block overflow-hidden rounded-lg bg-[#f0eeeb]">
      <span className={`relative block ${big ? "aspect-[3/4]" : "aspect-[4/3]"}`}>
        {product.image ? <Image src={product.image} alt={product.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="220px" /> : null}
      </span>
      <span className="block p-3">
        <span className="block text-[13px] font-semibold text-[#1a1a1a]">{product.title}</span>
        <span className="mt-0.5 block text-[12px] text-[#b0703f]">Shop now →</span>
      </span>
    </Link>
  );
}
