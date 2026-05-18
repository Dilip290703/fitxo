"use client";

import { useEffect, useMemo, useState } from "react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { FilterSidebar } from "@/components/products/FilterSidebar";
import { Pagination } from "@/components/products/Pagination";
import { ProductGrid } from "@/components/products/ProductGrid";
import { ProductNavbar } from "@/components/products/ProductNavbar";
import { SortDropdown } from "@/components/products/SortDropdown";
import { catalogProducts } from "@/lib/mockData";

type ProductsCatalogPageProps = {
  initialCategory?: string;
  initialCollection?: string;
  initialSale?: boolean;
};

type SortOption = "new-arrivals" | "popular" | "price-low" | "price-high";

type SelectedFilters = {
  audiences: string[];
  brands: string[];
  categories: string[];
  sizes: string[];
  priceRange: [number, number];
};

const PRODUCTS_PER_PAGE = 9;
const CATEGORY_MAP: Record<string, string> = {
  men: "men",
  women: "women",
  kids: "kids",
  child: "kids",
  home: "home",
  collections: "collections",
  ethnic: "ethnic",
};

function normalizeCategory(category?: string) {
  if (!category) return "women";
  return CATEGORY_MAP[category] ?? category;
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
  const [filters, setFilters] = useState<SelectedFilters>({
    audiences: [],
    brands: [],
    categories: [],
    sizes: [],
    priceRange: [120, 300],
  });

  const filteredProducts = useMemo(() => {
    let result = catalogProducts.filter((product) => {
      if (initialSale && !product.sale) return false;
      if (initialCollection && product.collection !== initialCollection) {
        return false;
      }

      if (filters.audiences.length > 0 && !filters.audiences.includes(product.audience)) {
        return false;
      }

      if (
        filters.brands.length > 0 &&
        !filters.brands.includes(product.brand.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.categories.length > 0 &&
        !filters.categories.includes(product.productCategory)
      ) {
        return false;
      }

      if (
        filters.sizes.length > 0 &&
        !filters.sizes.includes(product.sizeLabel.toLowerCase())
      ) {
        return false;
      }

      if (
        product.price < filters.priceRange[0] ||
        product.price > filters.priceRange[1]
      ) {
        return false;
      }

      return true;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === "popular") return b.popularity - a.popularity;
      if (sortBy === "price-low") return a.price - b.price;
      if (sortBy === "price-high") return b.price - a.price;
      return Number(b.isNewArrival) - Number(a.isNewArrival);
    });

    return result;
  }, [activeCategory, filters, initialCollection, initialSale, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE),
  );
  const pagedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [currentPage, filteredProducts.length]);

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
    setCurrentPage(1);
  };

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
            <span className="font-semibold text-[#222222]">Showing 1 - 20</span>{" "}
            out of 2,356 Products
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

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="hidden lg:block">
            <FilterSidebar
              filters={filters}
              onToggleFilter={handleToggleFilter}
              onPriceChange={(value) => {
                setFilters((current) => ({ ...current, priceRange: value }));
                setCurrentPage(1);
              }}
            />
          </div>

          <div>
            <ProductGrid
              products={
                pagedProducts.length
                  ? pagedProducts
                  : filteredProducts.slice(0, 9)
              }
            />
            <div className="mt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
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
