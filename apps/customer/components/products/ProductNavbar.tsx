"use client";

import Link from "next/link";

type ProductNavbarProps = {
  activeCategory: string;
  onCategoryChange: (value: string) => void;
};

const categories = [
  { label: "Men", value: "men" },
  { label: "Women", value: "women" },
  { label: "Child", value: "kids" },
  { label: "Ethnic", value: "ethnic" },
  { label: "Collections", value: "collections" },
];

function ChevronDown() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3 w-3 opacity-60">
      <path
        d="M5 7.5L10 12.5L15 7.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function ProductNavbar({
  activeCategory,
  onCategoryChange,
}: ProductNavbarProps) {
  return (
    <div className="border-b border-[#efe8de] bg-[#f7f4ee]">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-4 sm:px-6 lg:px-10">
        <div className="hide-scrollbar overflow-x-auto">
          <nav className="flex min-w-max items-center gap-8 text-[13px] text-[#777068]">
            {categories.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onCategoryChange(item.value)}
                className={`flex items-center gap-2 transition duration-200 hover:text-black ${
                  activeCategory === item.value ? "text-black" : ""
                }`}
              >
                <span>{item.label}</span>
                <ChevronDown />
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6 overflow-hidden rounded-sm bg-[#161d2c]">
          <div className="relative px-5 py-7 sm:px-8 sm:py-9">
            <div className="absolute inset-y-0 right-0 w-[145px] overflow-hidden">
              <div className="absolute -right-10 top-0 h-full w-20 rotate-[28deg] bg-[#3f7f93]" />
              <div className="absolute right-8 top-0 h-full w-10 rotate-[28deg] bg-[#f15858]" />
            </div>

            <div className="relative z-10">
              <h2 className="text-[18px] font-semibold text-white">Ladies Top</h2>
              <p className="mt-3 max-w-[700px] text-[13px] text-[#cbcdd4]">
                Slash Sales begins in April. Get up to 80% Discount on all products{" "}
                <Link href="/products?sale=true" className="font-semibold text-white">
                  Read More
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
