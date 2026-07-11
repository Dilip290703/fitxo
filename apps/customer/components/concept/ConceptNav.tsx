"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { CxIcon, CX_ICONS, type ConceptProduct } from "@/components/concept/shared";

/**
 * ARLUNE-style top chrome for the FITZO concept: announcement bar + header
 * with a hover mega-menu. Content is FITZO (try-before-you-buy), visual
 * style is copied from the reference. Isolated to /concept.
 */

const NAV = [
  { label: "Shop", mega: true },
  { label: "Men", href: "#" },
  { label: "Women", href: "#" },
  { label: "Collections", href: "#" },
  { label: "Try at Home", href: "#" },
  { label: "Journal", href: "#journal" },
];

const SHOP_CATEGORIES = ["Fancy Top", "Jacket", "Jeans", "Shorts", "Shirts", "Sweaters", "T-Shirts", "Footwear"];

function SocialDot({ path }: { path: string }) {
  return (
    <a href="#" className="text-white/70 transition hover:text-white" aria-label="social">
      <CxIcon path={path} className="h-4 w-4" />
    </a>
  );
}

export function ConceptNav({ featured }: { featured: ConceptProduct[] }) {
  const [megaOpen, setMegaOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white">
      {/* Announcement bar */}
      <div className="bg-[#1a1a1a] text-white">
        <div className="mx-auto flex h-10 max-w-[1400px] items-center justify-between px-5 text-[12px] lg:px-8">
          <div className="hidden items-center gap-4 md:flex">
            <SocialDot path="M15 8a4 4 0 0 1 4 4v5h-3v-5a1 1 0 0 0-2 0v5h-3v-9h3v1a3 3 0 0 1 1-1zM5 9h3v8H5zM6.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
            <SocialDot path="M17 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4zm-5 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm5-1v0" />
            <SocialDot path="M21 6s-.2-1.5-.8-2.1c-.8-.8-1.7-.8-2.1-.9C15.3 3 12 3 12 3s-3.3 0-6.1.2c-.4 0-1.3 0-2.1.9C3.2 4.6 3 6 3 6s-.2 1.7-.2 3.4v1.2C2.8 12.3 3 14 3 14s.2 1.5.8 2.1c.8.8 1.9.8 2.4.9 1.7.2 5.8.2 5.8.2s3.3 0 6.1-.2c.4 0 1.3 0 2.1-.9.6-.6.8-2.1.8-2.1s.2-1.7.2-3.4V9.4C21.2 7.7 21 6 21 6zM10 14V8l5 3-5 3z" />
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
      <div
        className="border-b border-[#eee]"
        onMouseLeave={() => setMegaOpen(false)}
      >
        <div className="mx-auto flex h-[70px] max-w-[1400px] items-center justify-between px-5 lg:px-8">
          <Link href="/concept" className="font-sans text-[26px] font-bold tracking-[0.28em] text-[#1a1a1a]">
            FITZO
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {NAV.map((item) => (
              <div
                key={item.label}
                onMouseEnter={() => setMegaOpen(!!item.mega)}
                className="group relative"
              >
                <button className="flex items-center gap-1 py-6 text-[15px] text-[#333] transition group-hover:text-[#b0703f]">
                  {item.label}
                  {item.mega ? <CxIcon path={CX_ICONS.chevron} className="h-3.5 w-3.5" /> : null}
                </button>
                <span className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto h-[2px] w-0 bg-[#b0703f] transition-all duration-300 group-hover:w-full" />
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

        {/* Shop mega-menu */}
        <div
          className={`absolute inset-x-0 top-full origin-top border-b border-[#eee] bg-white shadow-[0_24px_50px_-24px_rgba(0,0,0,0.18)] transition-all duration-300 ${
            megaOpen ? "pointer-events-auto opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
          }`}
          onMouseEnter={() => setMegaOpen(true)}
        >
          <div className="mx-auto grid max-w-[1400px] grid-cols-[1fr_1.4fr] gap-10 px-8 py-8">
            <div>
              <h4 className="mb-4 border-b border-[#1a1a1a] pb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#1a1a1a]">
                Shop by category
              </h4>
              <ul className="grid grid-cols-2 gap-y-2.5 text-[14px] text-[#555]">
                {SHOP_CATEGORIES.map((c) => (
                  <li key={c}><Link href="/products" className="transition hover:text-[#b0703f]">{c}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 border-b border-[#1a1a1a] pb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#1a1a1a]">
                Featured
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {featured.slice(0, 2).map((p) => (
                  <Link key={p.id} href="/products" className="group flex items-center gap-3 rounded-lg bg-[#f0eeeb] p-3 transition hover:bg-[#e9e5df]">
                    <span className="relative h-16 w-14 shrink-0 overflow-hidden rounded bg-white">
                      {p.image ? <Image src={p.image} alt={p.title} fill className="object-cover" sizes="56px" /> : null}
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold text-[#1a1a1a]">{p.title}</span>
                      <span className="mt-0.5 block text-[12px] text-[#b0703f]">Shop now →</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
