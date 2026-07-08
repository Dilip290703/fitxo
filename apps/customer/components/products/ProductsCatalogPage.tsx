"use client";

import { useCallback, useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { FilterSidebar, type SelectedFilters } from "@/components/products/FilterSidebar";
import { Pagination } from "@/components/products/Pagination";
import { ProductGrid } from "@/components/products/ProductGrid";
import { ProductNavbar } from "@/components/products/ProductNavbar";
import { SortDropdown } from "@/components/products/SortDropdown";
import { createClient } from "@fitzo/supabase/client";
import {
  queryProducts,
  queryFilterOptions,
  queryCategoryIdsByGender,
  type FrontendProduct,
  type FilterOptions,
} from "@/lib/supabase/products";

type ProductsCatalogPageProps = {
  initialCategory?: string;
  initialCollection?: string;
  initialSale?: boolean;
};

type SortOption = "new-arrivals" | "popular" | "price-low" | "price-high";

// 4 across × 4 down on xl — a full, unragged grid per page.
const PRODUCTS_PER_PAGE = 16;

const CATEGORY_MAP: Record<string, string> = {
  men: "men",
  women: "women",
  kids: "kids",
  child: "kids",
};

/** No category in the URL means "everything" — not Women. */
function normalizeCategory(category?: string) {
  if (!category) return "";
  return CATEGORY_MAP[category] ?? category;
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: PRODUCTS_PER_PAGE }).map((_, i) => (
        <div key={i} className="overflow-hidden border border-[#eee7de] bg-white">
          <div className="h-[262px] animate-pulse bg-[#f0ece4] sm:h-[298px]" />
          <div className="px-3 pb-4 pt-3 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[#f0ece4]" />
            <div className="h-4 w-1/4 animate-pulse rounded bg-[#f0ece4]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductsCatalogPage({
  initialCategory,
  initialCollection,
  initialSale = false,
}: ProductsCatalogPageProps) {
  const [sortBy, setSortBy] = useState<SortOption>("new-arrivals");
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(
    normalizeCategory(initialCategory),
  );

  const [products, setProducts] = useState<FrontendProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    brands: [],
    categories: [],
    priceRange: [0, 10000],
  });

  const [filters, setFilters] = useState<SelectedFilters>({
    brandIds: [],
    categoryIds: [],
    priceRange: [0, 10000],
  });

  // Load filter options once on mount
  useEffect(() => {
    const supabase = createClient();
    queryFilterOptions(supabase).then((opts) => {
      setFilterOptions(opts);
      setFilters((prev) => ({ ...prev, priceRange: opts.priceRange }));
    });
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Resolve gender-based category IDs for the active nav category
    let genderCategoryIds: string[] = [];
    if (activeCategory in CATEGORY_MAP) {
      genderCategoryIds = await queryCategoryIdsByGender(
        supabase,
        CATEGORY_MAP[activeCategory],
      );
    }

    // Merge gender categories with sidebar-selected categories
    const combinedCategoryIds =
      filters.categoryIds.length > 0
        ? filters.categoryIds
        : genderCategoryIds.length > 0
          ? genderCategoryIds
          : undefined;

    const { products: fetchedProducts, total: fetchedTotal } = await queryProducts(
      supabase,
      {
        brandIds: filters.brandIds.length > 0 ? filters.brandIds : undefined,
        categoryIds: combinedCategoryIds,
        priceMin: filters.priceRange[0],
        priceMax: filters.priceRange[1],
        onlySale: initialSale,
        sortBy,
        page: currentPage,
        perPage: PRODUCTS_PER_PAGE,
      },
    );

    setProducts(fetchedProducts);
    setTotal(fetchedTotal);
    setLoading(false);
  }, [activeCategory, filters, initialSale, sortBy, currentPage]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));

  const handleToggleFilter = (
    group: keyof Omit<SelectedFilters, "priceRange">,
    value: string,
  ) => {
    setCurrentPage(1);
    setFilters((current) => {
      const exists = current[group].includes(value);
      return {
        ...current,
        [group]: exists
          ? current[group].filter((item) => item !== value)
          : [...current[group], value],
      };
    });
  };

  const handleCategoryChange = (value: string) => {
    setActiveCategory(normalizeCategory(value));
    setFilters((prev) => ({ ...prev, categoryIds: [] }));
    setCurrentPage(1);
  };

  const showingFrom = (currentPage - 1) * PRODUCTS_PER_PAGE + 1;
  const showingTo = Math.min(currentPage * PRODUCTS_PER_PAGE, total);

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <Navbar showSecondaryNav={false} searchMode="field" />
      <ProductNavbar
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
      />

      <section className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-[12px] text-[#4a463f]">
            {total > 0 ? (
              <>
                <span className="font-semibold text-[#222222]">
                  Showing {showingFrom} – {showingTo}
                </span>{" "}
                out of {total} Products
              </>
            ) : loading ? (
              <span className="text-[#a3a09c]">Loading…</span>
            ) : (
              <span className="text-[#a3a09c]">No products found</span>
            )}
          </p>

          <div className="flex items-center justify-between gap-4 md:justify-end">
            <button
              type="button"
              onClick={() => setIsMobileFiltersOpen(true)}
              className="inline-flex h-10 items-center rounded-sm border border-[#ddd7ce] px-4 text-[12px] font-medium text-[#232323] lg:hidden"
            >
              Filters
            </button>
            <SortDropdown
              value={sortBy}
              onChange={(value) => {
                setSortBy(value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Filter rail pins itself under the sticky navbar and scrolls its own
              overflow. `overscroll-contain` stops a filter-list scroll from
              chaining into the page once the rail bottoms out. */}
          <div className="hidden lg:sticky lg:top-[88px] lg:block lg:max-h-[calc(100vh-104px)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1 [scrollbar-width:thin]">
            <FilterSidebar
              filters={filters}
              brands={filterOptions.brands}
              categories={filterOptions.categories}
              priceMin={filterOptions.priceRange[0]}
              priceMax={filterOptions.priceRange[1]}
              onToggleFilter={handleToggleFilter}
              onPriceChange={(value) => {
                setFilters((current) => ({ ...current, priceRange: value }));
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Desktop: the grid owns its scroll. Wheeling with the cursor over
              the products moves the grid; `overscroll-contain` keeps that
              gesture from chaining into the page once the grid bottoms out.
              Cursor anywhere else (banner, header, footer) scrolls the page.
              Mobile keeps a single, normal page scroll — an inner scroll
              region on a phone is a trap. */}
          <div className="lg:sticky lg:top-[88px] lg:h-[calc(100vh-104px)] lg:overflow-y-auto lg:overscroll-contain lg:pr-2 [scrollbar-width:thin]">
            {loading ? (
              <LoadingSkeleton />
            ) : (
              <ProductGrid products={products} />
            )}
            {!loading && totalPages > 1 ? (
              <div className="mt-8 pb-2">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {isMobileFiltersOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/35 lg:hidden"
          onClick={() => setIsMobileFiltersOpen(false)}
        >
          <div
            className="ml-auto h-full w-full max-w-[340px] overflow-y-auto bg-[#fbfaf7] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <FilterSidebar
              filters={filters}
              brands={filterOptions.brands}
              categories={filterOptions.categories}
              priceMin={filterOptions.priceRange[0]}
              priceMax={filterOptions.priceRange[1]}
              onToggleFilter={handleToggleFilter}
              onPriceChange={(value) => {
                setFilters((current) => ({ ...current, priceRange: value }));
                setCurrentPage(1);
              }}
              onCloseMobile={() => setIsMobileFiltersOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <Footer />
    </main>
  );
}
