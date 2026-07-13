"use client";

type ProductNavbarProps = {
  activeCategory: string;
  onCategoryChange: (value: string) => void;
  isSale?: boolean;
};

/**
 * Snitch-style catalogue header: centred serif title over a row of
 * bordered pill tabs. Tabs are the real gender buckets the catalogue
 * can actually filter by — nothing decorative.
 */
const categories = [
  // "" = no gender filter. Without this the user can never get back to the
  // unfiltered list after picking a category.
  { label: "All", value: "" },
  { label: "Men", value: "men" },
  { label: "Women", value: "women" },
  { label: "Kids", value: "kids" },
];

export function ProductNavbar({
  activeCategory,
  onCategoryChange,
  isSale = false,
}: ProductNavbarProps) {
  return (
    <div className="border-b border-[#e6dac8] bg-[#faf9f6]">
      <div className="mx-auto w-full px-4 pb-6 pt-9 text-center sm:px-6">
        <h1 className="font-display text-[26px] font-medium tracking-[-0.01em] text-[#221b13] sm:text-[32px]">
          {isSale ? "On Sale" : "New & Popular"}
        </h1>

        <div className="hide-scrollbar mt-6 overflow-x-auto">
          <nav
            aria-label="Product categories"
            className="mx-auto flex min-w-max items-center justify-center gap-2.5"
          >
            {categories.map((item) => {
              const active = activeCategory === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onCategoryChange(item.value)}
                  aria-pressed={active}
                  className={`inline-flex h-9 items-center border px-5 text-[12px] font-medium uppercase tracking-[0.08em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/50 ${
                    active
                      ? "border-[#221b13] bg-[#221b13] text-[#faf9f6]"
                      : "border-[#cbb9a4] bg-white text-[#221b13] hover:border-[#221b13]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
