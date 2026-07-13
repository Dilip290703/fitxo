"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { inr, type ConceptProduct } from "@/components/concept/shared";
import { CxActions } from "@/components/concept/CxActions";
import { CxReveal, CxRevealGroup, CxRiseChild } from "@/components/concept/CxReveal";

/**
 * "BEST SELLERS" with category tabs (Fitzo landing). Cards show a discount
 * badge, category, name, price (+ strikethrough), colour swatches, and a row
 * of hover action icons (wishlist/quick-view/compare/cart) that slide up.
 */
const TABS = ["Fancy Top", "Shirts", "Pants", "Shorts"];
const SWATCHES = ["#1a1a1a", "#e9e5df", "#c0392b"];

function Card({ product }: { product: ConceptProduct }) {
  const hasDiscount = product.oldPrice > product.price;
  const off = hasDiscount ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;

  return (
    <div className="group flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[6px] bg-[#f0eeeb]">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.title}
            fill
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : null}
        {hasDiscount ? (
          <span className="absolute left-0 top-4 bg-[#c0392b] px-2.5 py-1 text-[12px] font-semibold text-white">-{off}%</span>
        ) : null}
        <CxActions />
      </div>

      <div className="mt-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a9a9a]">
          {product.badge || "Tops"}
        </p>
        <Link href="/products" className="mt-1 block text-[16px] font-medium text-[#1a1a1a] transition hover:text-[#b0703f]">
          {product.title}
        </Link>
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <span className={`text-[15px] font-semibold ${hasDiscount ? "text-[#b0703f]" : "text-[#1a1a1a]"}`}>{inr(product.price)}</span>
          {hasDiscount ? <span className="text-[13px] text-[#a9a9a9] line-through">{inr(product.oldPrice)}</span> : null}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          {SWATCHES.map((c, i) => (
            <span key={c} className={`h-4 w-4 rounded-full ring-1 ring-[#d8d3cb] ${i === 0 ? "ring-2 ring-[#1a1a1a]" : ""}`} style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BestSellers({ products }: { products: ConceptProduct[] }) {
  const [tab, setTab] = useState(0);
  if (products.length === 0) return null;

  // Demo: each tab shows a different rotated slice of the live catalogue.
  const start = (tab * 4) % Math.max(1, products.length - 3);
  const shown = products.slice(start, start + 4);

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
        <CxReveal className="text-center">
          <h2 className="font-sans text-[clamp(2rem,4vw,3rem)] font-black uppercase text-[#1a1a1a]">Best Sellers</h2>
          <p className="mx-auto mt-4 max-w-[560px] text-[15px] text-[#6b6b6b]">
            Each edit is curated in small batches from stores near you — try them on before you commit.
          </p>
          <div className="mt-7 flex items-center justify-center gap-8">
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                className={`relative pb-2 text-[16px] transition ${i === tab ? "font-semibold text-[#1a1a1a]" : "text-[#9a9a9a] hover:text-[#1a1a1a]"}`}
              >
                {t}
                <span className={`absolute inset-x-0 bottom-0 h-[2px] bg-[#1a1a1a] transition-all duration-300 ${i === tab ? "opacity-100" : "opacity-0"}`} />
              </button>
            ))}
          </div>
        </CxReveal>

        <CxRevealGroup key={tab} className="mt-12 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4">
          {shown.map((p) => (
            <CxRiseChild key={p.id}><Card product={p} /></CxRiseChild>
          ))}
        </CxRevealGroup>

        <div className="mt-12 flex justify-center">
          <Link href="/products" className="inline-flex h-12 items-center bg-[#b0703f] px-10 text-[12px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#98602f]">
            All Products
          </Link>
        </div>
      </div>
    </section>
  );
}
