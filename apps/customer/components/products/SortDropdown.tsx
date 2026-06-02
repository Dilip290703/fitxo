"use client";

type SortOption = "new-arrivals" | "popular" | "price-low" | "price-high";

type SortDropdownProps = {
  value: SortOption;
  onChange: (value: SortOption) => void;
};

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-[#7a746c]">
      <span>Sort by:</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as SortOption)}
          className="appearance-none border-none bg-transparent pr-5 text-[12px] font-semibold text-[#202020] outline-none"
        >
          <option value="new-arrivals">New Arrivals</option>
          <option value="popular">Popular</option>
          <option value="price-low">Price Low to High</option>
          <option value="price-high">Price High to Low</option>
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-[#4b4741]">
          ▼
        </span>
      </div>
    </label>
  );
}
