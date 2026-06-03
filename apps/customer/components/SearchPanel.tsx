"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { brands, products } from "@/lib/mockData";

export function SearchPanel() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return products.slice(0, 6);
    }

    return products.filter((product) => {
      return (
        product.title.toLowerCase().includes(normalized) ||
        product.brand.toLowerCase().includes(normalized) ||
        product.subtitle.toLowerCase().includes(normalized)
      );
    });
  }, [query]);

  const suggestedBrands = useMemo(() => brands.slice(0, 6), []);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_320px]">
      <div>
        <div className="rounded-[24px] border border-[#e8ddd1] bg-white p-5 shadow-[0_18px_40px_rgba(28,23,18,0.05)]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search brands, outfits, and categories"
            className="h-14 w-full border-none bg-transparent text-[18px] text-[#171717] outline-none placeholder:text-[#8b7f73]"
          />
        </div>

        <div className="mt-8 grid gap-4">
          {results.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              className="rounded-[22px] border border-[#eadfd4] bg-white px-6 py-5 transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(28,23,18,0.08)]"
            >
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#8a7b6d]">
                {product.brand}
              </p>
              <h3 className="mt-2 font-display text-[28px] leading-none text-[#171717]">
                {product.title}
              </h3>
              <p className="mt-3 text-[14px] text-[#5d574f]">{product.subtitle}</p>
            </Link>
          ))}
        </div>
      </div>

      <aside className="rounded-[28px] border border-[#eadfd4] bg-white p-7 shadow-[0_18px_40px_rgba(28,23,18,0.05)]">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#8a7b6d]">
          Suggested brands
        </p>
        <div className="mt-5 space-y-3">
          {suggestedBrands.map((brand) => (
            <Link
              key={brand.slug}
              href={`/brand/${brand.slug}`}
              className="block rounded-[16px] border border-[#eee4d9] px-4 py-4 text-[14px] transition duration-200 hover:bg-[#fbf7f1]"
            >
              {brand.name}
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
