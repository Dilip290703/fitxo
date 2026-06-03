"use client";

import { useState } from "react";
import type { FilterOption } from "@/lib/supabase/products";
import { PriceSlider } from "@/components/products/PriceSlider";

type FilterKey = "brandIds" | "categoryIds";

export type SelectedFilters = {
  brandIds: string[];
  categoryIds: string[];
  priceRange: [number, number];
};

type FilterSidebarProps = {
  filters: SelectedFilters;
  brands: FilterOption[];
  categories: FilterOption[];
  priceMin: number;
  priceMax: number;
  onToggleFilter: (group: FilterKey, value: string) => void;
  onPriceChange: (value: [number, number]) => void;
  onCloseMobile?: () => void;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={`text-[10px] text-[#58524a] transition duration-200 ${open ? "rotate-180" : ""}`}
    >
      ▼
    </span>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[12px] text-[#44403b]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-[15px] w-[15px] rounded-none border border-[#8f8a84] accent-[#1b2230]"
      />
      <span>{label}</span>
    </label>
  );
}

function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[#f0ebe4] pt-6 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-[#232323]">
          {title}
        </h3>
        <Chevron open={open} />
      </button>
      {open ? <div className="mt-5 space-y-4">{children}</div> : null}
    </div>
  );
}

export function FilterSidebar({
  filters,
  brands,
  categories,
  priceMin,
  priceMax,
  onToggleFilter,
  onPriceChange,
  onCloseMobile,
}: FilterSidebarProps) {
  const [openSections, setOpenSections] = useState({
    prices: true,
    brands: true,
    categories: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <aside className="w-full bg-[#fbfaf7]">
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#232323]">
          Filters
        </p>
        {onCloseMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="text-[12px] font-medium text-[#5f5750]"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="border border-[#f0ebe4] bg-white p-5">
        <AccordionSection
          title="Prices"
          open={openSections.prices}
          onToggle={() => toggleSection("prices")}
        >
          <PriceSlider
            min={priceMin}
            max={priceMax}
            value={filters.priceRange}
            onChange={onPriceChange}
          />
        </AccordionSection>

        <AccordionSection
          title="Brands"
          open={openSections.brands}
          onToggle={() => toggleSection("brands")}
        >
          {brands.length > 0 ? (
            brands.map((brand) => (
              <CheckboxRow
                key={brand.id}
                label={brand.name}
                checked={filters.brandIds.includes(brand.id)}
                onChange={() => onToggleFilter("brandIds", brand.id)}
              />
            ))
          ) : (
            <p className="text-[12px] text-[#a3a09c]">Loading brands…</p>
          )}
        </AccordionSection>

        <AccordionSection
          title="Categories"
          open={openSections.categories}
          onToggle={() => toggleSection("categories")}
        >
          {categories.length > 0 ? (
            categories.map((cat) => (
              <CheckboxRow
                key={cat.id}
                label={cat.name}
                checked={filters.categoryIds.includes(cat.id)}
                onChange={() => onToggleFilter("categoryIds", cat.id)}
              />
            ))
          ) : (
            <p className="text-[12px] text-[#a3a09c]">Loading categories…</p>
          )}
        </AccordionSection>
      </div>
    </aside>
  );
}
