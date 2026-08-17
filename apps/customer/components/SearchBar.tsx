"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createClient } from "@fitxo/supabase/client";
import { queryProducts, type FrontendProduct } from "@/lib/supabase/products";

const DEBOUNCE_MS = 250;
const MAX_SUGGESTIONS = 6;

function SearchGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ClearGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

/**
 * Inline product typeahead. Replaces the old "search button that navigates to
 * /search" — results appear in a dropdown under the field and the user only
 * leaves the page when they explicitly ask for the full results view
 * (Enter on the query, or "View all results"). Selecting a suggestion jumps
 * straight to that product.
 *
 * `variant="field"` renders a persistent pill (product pages); `"icon"` renders
 * an icon button that expands into the same field (marketing pages).
 */
export function SearchBar({
  variant = "icon",
  active = false,
}: {
  variant?: "icon" | "field";
  active?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Guards against a slow request overwriting a newer one. */
  const requestSeq = useRef(0);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FrontendProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const trimmed = query.trim();

  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }

    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const supabase = createClient();
      const { products } = await queryProducts(supabase, {
        searchQuery: q,
        perPage: MAX_SUGGESTIONS,
        sortBy: "new-arrivals",
      });
      if (seq !== requestSeq.current) return; // a newer keystroke already fired
      setResults(products);
    } catch {
      if (seq !== requestSeq.current) return;
      setResults([]);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  // Debounce the query; clears immediately when the field empties.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(trimmed), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed, runSearch]);

  // Reset the keyboard cursor whenever the result set changes.
  useEffect(() => setHighlighted(-1), [results]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const open = () => {
    setIsOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const goToResults = () => {
    if (!trimmed) return;
    setIsOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const goToProduct = (id: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(`/product/${id}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((i) => (results.length ? (i + 1) % results.length : -1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((i) =>
        results.length ? (i <= 0 ? results.length - 1 : i - 1) : -1,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (highlighted >= 0 && results[highlighted]) {
        goToProduct(results[highlighted].id);
      } else {
        goToResults();
      }
    }
  };

  const showDropdown = isOpen && trimmed.length > 0;
  const hasResults = results.length > 0;

  return (
    <div ref={rootRef} className="relative">
      {/* The collapsed button always holds its footprint — when the field opens
          it only goes `invisible`, and the input overlays on top. Swapping the
          two in-flow would reflow the whole navbar (logo shifts, links wrap). */}
      <button
        type="button"
        onClick={open}
        aria-label="Search products"
        aria-expanded={isOpen}
        aria-hidden={isOpen}
        tabIndex={isOpen ? -1 : 0}
        className={`${isOpen ? "invisible" : ""} ${
          variant === "field"
            ? `group relative flex h-10 items-center gap-3 rounded-md bg-white px-4 text-[13px] shadow-[inset_0_0_0_1px_rgba(215,207,198,0.85)] transition duration-200 hover:-translate-y-0.5 hover:text-[#221b13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/70 ${
                active ? "text-[#221b13]" : "text-[#78726a]"
              }`
            : `group relative flex h-10 w-10 items-center justify-center rounded-full transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-[#221b13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/70 ${
                active ? "text-[#221b13]" : "text-[#6f6860]"
              }`
        }`}
      >
        {variant === "field" ? <span>Search</span> : null}
        <SearchGlyph />
      </button>

      {isOpen ? (
        /* Phones: the icon sits mid-header with cart/profile to its right, so
           anchoring the field to the button would run it off the left edge.
           Pin it to the viewport instead. md+: anchor to the button as usual. */
        <div className="fixed left-3 right-3 top-3 z-[60] flex h-10 items-center gap-2 rounded-md bg-white px-3 shadow-[inset_0_0_0_1px_rgba(31,42,60,0.28),0_10px_28px_-14px_rgba(24,24,28,0.4)] md:absolute md:left-auto md:right-0 md:top-1/2 md:w-[340px] md:-translate-y-1/2">
          <span className="shrink-0 text-[#78726a]">
            <SearchGlyph className="h-[18px] w-[18px]" />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for shirts, dresses, brands…"
            aria-label="Search products"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={listId}
            aria-activedescendant={
              highlighted >= 0 ? `${listId}-opt-${highlighted}` : undefined
            }
            role="combobox"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-[#232323] outline-none placeholder:text-[#a8a29b] [&::-webkit-search-cancel-button]:appearance-none"
          />
          {trimmed ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="shrink-0 rounded-full p-1 text-[#a8a29b] transition hover:bg-[#f2efe9] hover:text-[#221b13]"
            >
              <ClearGlyph />
            </button>
          ) : null}
        </div>
      ) : null}

      {showDropdown ? (
        <div className="fixed left-3 right-3 top-[60px] z-[60] overflow-hidden rounded-xl border border-[#e7e1d8] bg-white shadow-[0_24px_48px_rgba(24,24,28,0.14)] md:absolute md:left-auto md:right-0 md:top-[calc(100%+8px)] md:w-[min(90vw,420px)]">
          <ul id={listId} role="listbox" aria-label="Product suggestions">
            {loading && !hasResults ? (
              <li className="px-4 py-6 text-center text-[13px] text-[#78726a]">
                Searching…
              </li>
            ) : null}

            {!loading && !hasResults ? (
              <li className="px-4 py-6 text-center text-[13px] text-[#78726a]">
                No matches for “{trimmed}”.
              </li>
            ) : null}

            {results.map((product, index) => (
              <li key={product.id} id={`${listId}-opt-${index}`} role="option" aria-selected={highlighted === index}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => goToProduct(product.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                    highlighted === index ? "bg-[#f7f4ee]" : "bg-white"
                  }`}
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[#f2efe9]">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[#232323]">
                      {product.title}
                    </span>
                    <span className="block truncate text-[11px] uppercase tracking-[0.14em] text-[#a48d78]">
                      {product.brand}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-[#221b13]">
                    {formatPrice(product.price)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {hasResults ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={goToResults}
              className="flex w-full items-center justify-center gap-2 border-t border-[#e6dac8] bg-[#fbfaf7] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#221b13] transition hover:bg-[#f5f0e8]"
            >
              View all results
              <span aria-hidden="true">→</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
