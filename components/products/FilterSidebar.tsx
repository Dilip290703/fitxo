"use client";

import { useState } from "react";
import { PriceSlider } from "@/components/products/PriceSlider";

type FilterKey = "audiences" | "brands" | "categories" | "sizes";

type SelectedFilters = {
  audiences: string[];
  brands: string[];
  categories: string[];
  sizes: string[];
  priceRange: [number, number];
};

type FilterSidebarProps = {
  filters: SelectedFilters;
  onToggleFilter: (group: FilterKey, value: string) => void;
  onPriceChange: (value: [number, number]) => void;
  onCloseMobile?: () => void;
};

const audienceOptions = ["Women", "Ladies", "Girls", "Babies"];
const brandOptions = [
  "H&M",
  "Marks & Spencer",
  "Victoria's Secret",
  "Dior",
  "Gucci",
  "Fendi",
  "Prada",
  "Versace",
  "Dolce & Gabbana",
  "Zara",
  "Chanel",
];
const categoryOptions = [
  "Dresses",
  "Tops",
  "Lingerie & Lounge Wear",
  "Blouse",
  "Vintage",
];

const categoryValueMap: Record<string, string> = {
  Dresses: "dresses",
  Tops: "tops",
  "Lingerie & Lounge Wear": "lingerie-lounge-wear",
  Blouse: "blouse",
  Vintage: "vintage",
};
const sizeOptions = ["Medium", "Large", "Plus Size", "Sexy Plus Size"];

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
  onToggleFilter,
  onPriceChange,
  onCloseMobile,
}: FilterSidebarProps) {
  const [openSections, setOpenSections] = useState({
    prices: true,
    filters: true,
    brands: true,
    categories: true,
    size: true,
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
            min={120}
            max={300}
            value={filters.priceRange}
            onChange={onPriceChange}
          />
        </AccordionSection>

        <AccordionSection
          title="Filters"
          open={openSections.filters}
          onToggle={() => toggleSection("filters")}
        >
          {audienceOptions.map((option) => (
            <CheckboxRow
              key={option}
              label={option}
              checked={filters.audiences.includes(option.toLowerCase())}
              onChange={() => onToggleFilter("audiences", option.toLowerCase())}
            />
          ))}
        </AccordionSection>

        <AccordionSection
          title="Brands"
          open={openSections.brands}
          onToggle={() => toggleSection("brands")}
        >
          {brandOptions.map((option) => (
            <CheckboxRow
              key={option}
              label={option}
              checked={filters.brands.includes(option.toLowerCase())}
              onChange={() => onToggleFilter("brands", option.toLowerCase())}
            />
          ))}
          <p className="pl-7 text-[12px] text-[#f06d6d]">+ 234 more</p>
        </AccordionSection>

        <AccordionSection
          title="Categories"
          open={openSections.categories}
          onToggle={() => toggleSection("categories")}
        >
          {categoryOptions.map((option) => (
            <CheckboxRow
              key={option}
              label={option}
              checked={filters.categories.includes(categoryValueMap[option])}
              onChange={() =>
                onToggleFilter("categories", categoryValueMap[option])
              }
            />
          ))}
          <p className="pl-7 text-[12px] text-[#f06d6d]">+ 4 more</p>
        </AccordionSection>

        <AccordionSection
          title="Size"
          open={openSections.size}
          onToggle={() => toggleSection("size")}
        >
          {sizeOptions.map((option) => (
            <CheckboxRow
              key={option}
              label={option}
              checked={filters.sizes.includes(option.toLowerCase())}
              onChange={() => onToggleFilter("sizes", option.toLowerCase())}
            />
          ))}
        </AccordionSection>
      </div>
    </aside>
  );
}
