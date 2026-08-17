"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@fitxo/supabase/client";
import { queryProducts, type FrontendProduct } from "@/lib/supabase/products";

const DEBOUNCE_MS = 320;

type Props = { initialQuery: string };

export function SearchResultsView({ initialQuery }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<FrontendProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { products } = await queryProducts(supabase, {
      searchQuery: trimmed,
      perPage: 24,
      sortBy: "new-arrivals",
    });
    setResults(products);
    setSearched(true);
    setLoading(false);
  }, []);

  // Run on mount if there's an initial query (e.g. from Navbar search)
  useEffect(() => {
    if (initialQuery.trim()) runSearch(initialQuery);
    inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    // Update URL so the query is shareable / back-navigable
    const params = new URLSearchParams();
    if (value.trim()) params.set("q", value.trim());
    router.replace(`/search${value.trim() ? `?${params}` : ""}`, { scroll: false });
    // Debounce the Supabase call
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), DEBOUNCE_MS);
  };

  return (
    <section className="mx-auto w-full max-w-[1100px] px-5 py-10 sm:px-6 lg:py-14">
      {/* Header */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
        Search
      </p>
      <h1 className="mt-3 font-display text-[34px] leading-none tracking-[-0.04em] text-[#171717] sm:text-[42px]">
        Find your next look
      </h1>

      {/* Search input */}
      <div className="mt-6 rounded-[24px] border border-[#e8ddd1] bg-white px-5 shadow-[0_18px_40px_rgba(28,23,18,0.05)]">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 shrink-0 text-[#9b8f83]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search brands, outfits, categories…"
            className="h-14 w-full border-none bg-transparent text-[17px] text-[#171717] outline-none placeholder:text-[#9b8f83]"
          />
          {query && (
            <button
              type="button"
              onClick={() => handleChange("")}
              className="shrink-0 rounded-full p-1 text-[#9b8f83] hover:text-[#221b13]"
              aria-label="Clear search"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Results area */}
      <div className="mt-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[220px] animate-pulse rounded-[22px] border border-[#eadfd4] bg-white/60" />
            ))}
          </div>
        ) : !query.trim() ? (
          <div className="py-16 text-center">
            <p className="text-[15px] font-semibold text-[#221b13]">What are you looking for?</p>
            <p className="mt-2 text-[14px] text-[#6b6258]">Type a product name, brand, or style above.</p>
            <Link
              href="/products"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#221b13] px-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-white transition hover:-translate-y-0.5"
            >
              Browse all products
            </Link>
          </div>
        ) : searched && results.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[15px] font-semibold text-[#221b13]">No results for &ldquo;{query}&rdquo;</p>
            <p className="mt-2 text-[14px] text-[#6b6258]">Try a different name or browse our full catalogue.</p>
            <Link
              href="/products"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#221b13] px-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-white transition hover:-translate-y-0.5"
            >
              Browse all products
            </Link>
          </div>
        ) : results.length > 0 ? (
          <>
            <p className="mb-4 text-[13px] text-[#8b7058]">
              {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group flex gap-4 rounded-[22px] border border-[#eadfd4] bg-white p-4 shadow-[0_14px_34px_rgba(34,28,20,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(28,23,18,0.08)]"
                >
                  {product.image ? (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[14px] bg-[#f6f1e8]">
                      <Image src={product.image} alt={product.title} fill className="object-cover" sizes="80px" />
                    </div>
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded-[14px] bg-[#f6f1e8]" />
                  )}
                  <div className="min-w-0 flex-1 py-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a7b6d]">{product.brand}</p>
                    <h2 className="mt-1 truncate text-[15px] font-semibold text-[#171717] group-hover:text-[#221b13]">
                      {product.title}
                    </h2>
                    <p className="mt-1 text-[13px] text-[#6b6258]">
                      ₹{product.price.toLocaleString("en-IN")}
                      {product.oldPrice > product.price && (
                        <span className="ml-2 text-[12px] text-[#9b8f83] line-through">
                          ₹{product.oldPrice.toLocaleString("en-IN")}
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
