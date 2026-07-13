"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { inr, type ConceptProduct } from "@/components/concept/shared";
import { CxReveal } from "@/components/concept/CxReveal";
import { CxParallax } from "@/components/concept/CxParallax";
import { CxActions } from "@/components/concept/CxActions";

/**
 * "FEATURED PRODUCT" split (ARLUNE reference): a large promo image card beside
 * two live product cards, then a time-sensitive countdown band whose digits
 * roll (odometer) on each tick. Content is FITZO / live catalogue.
 */
const SWATCHES = ["#7a4a2b", "#e9e5df", "#c0392b", "#1a1a1a"];

function useCountdown(target: number) {
  const [now, setNow] = useState(target);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target - now);
  const s = Math.floor(diff / 1000);
  return {
    days: String(Math.floor(s / 86400)).padStart(2, "0"),
    hours: String(Math.floor((s % 86400) / 3600)).padStart(2, "0"),
    mins: String(Math.floor((s % 3600) / 60)).padStart(2, "0"),
    secs: String(s % 60).padStart(2, "0"),
  };
}

/** A digit box whose number re-mounts (keyed) so .cx-roll replays each change. */
function TimeBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl bg-white shadow-sm">
        <span key={value} className="cx-roll block font-sans text-[28px] font-bold tabular-nums leading-none text-[#1a1a1a]">
          {value}
        </span>
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">{label}</p>
    </div>
  );
}

function ProductCard({ product }: { product: ConceptProduct }) {
  return (
    <div className="group flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-[#f0eeeb]">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.title}
            fill
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
            sizes="(max-width: 1024px) 50vw, 22vw"
          />
        ) : null}
        <CxActions />
      </div>
      <div className="mt-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a9a9a]">{product.badge || "New in"}</p>
        <Link href="/products" className="mt-1.5 block text-[16px] font-medium text-[#1a1a1a] transition group-hover:text-[#b0703f]">
          {product.title}
        </Link>
        <p className="mt-2 text-[15px] font-semibold text-[#1a1a1a]">{inr(product.price)}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          {SWATCHES.map((c, i) => (
            <span key={c} className={`h-4 w-4 rounded-full ring-1 ring-[#d8d3cb] ${i === 0 ? "ring-2 ring-[#1a1a1a]" : ""}`} style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function FeaturedProduct({ promoImage, products }: { promoImage: string; products: ConceptProduct[] }) {
  const [target] = useState(() => Date.now() + (6 * 86400 + 11 * 3600 + 30 * 60) * 1000);
  const t = useCountdown(target);
  const pair = products.slice(0, 2);

  return (
    <section className="bg-white pb-4 pt-10 sm:pt-14">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
        <CxReveal className="text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-[#b0703f]">New Arrivals</p>
          <h2 className="mt-3 font-sans text-[clamp(2rem,4vw,3rem)] font-black uppercase text-[#1a1a1a]">Featured Product</h2>
        </CxReveal>

        <CxReveal className="mt-12 grid gap-6 lg:grid-cols-[1.5fr_1fr_1fr]">
          <Link href="/products" className="group relative block overflow-hidden rounded-[16px] bg-[#f0eeeb]">
            <div className="relative aspect-[4/5] lg:aspect-auto lg:h-full">
              {promoImage ? (
                <CxParallax>
                  <Image src={promoImage} alt="New collection" fill className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105" sizes="(max-width: 1024px) 100vw, 40vw" />
                </CxParallax>
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            </div>
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/85">New Collection</p>
              <h3 className="mt-3 font-sans text-[34px] font-bold leading-none">Minimalist Design</h3>
              <p className="mt-3 max-w-[300px] text-[14px] text-white/85">Explore our curated edit of clean, wear-anywhere staples.</p>
              <span className="mt-6 inline-flex h-11 items-center border border-white/70 px-7 text-[11px] font-semibold uppercase tracking-[0.18em] transition group-hover:bg-white group-hover:text-[#1a1a1a]">Shop now</span>
            </div>
          </Link>

          {pair.map((p) => <ProductCard key={p.id} product={p} />)}
        </CxReveal>

        {/* Countdown band */}
        <CxReveal className="mt-6 flex flex-col items-center justify-between gap-6 rounded-[16px] bg-[#faf6f1] px-8 py-8 sm:flex-row">
          <div>
            <h3 className="font-sans text-[26px] font-bold leading-tight text-[#1a1a1a]">Summer sale — time-sensitive deals await!</h3>
            <p className="mt-1 text-[14px] text-[#6b6b6b]">Book a try-on slot before the window closes.</p>
          </div>
          <div className="flex items-center gap-4">
            <TimeBox value={t.days} label="Days" />
            <TimeBox value={t.hours} label="Hours" />
            <TimeBox value={t.mins} label="Mins" />
            <TimeBox value={t.secs} label="Secs" />
            <Link href="/products?sale=true" className="ml-2 hidden h-12 items-center bg-[#b0703f] px-7 text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#98602f] sm:inline-flex">Shop now</Link>
          </div>
        </CxReveal>
      </div>
    </section>
  );
}
