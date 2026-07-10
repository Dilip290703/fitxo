import Image from "next/image";
import Link from "next/link";
import { StaggerGroup, StaggerItem } from "@/components/motion";

/**
 * Editorial category band under the hero — the curated set Jay asked for
 * (2026-07-10): Women / Men / Kids / Footwear / Hot Picks / Sale.
 *
 * Every chip links to a real catalogue route. Caveat until Admin grows the
 * matching categories: a gender/category with no rows falls back to the full
 * catalogue (the /products page's own honest behaviour) rather than a dead
 * or faked bucket.
 */

type CategoryChip = {
  label: string;
  href: string;
  image?: string;
  alt?: string;
  /** object-position for the circular crop — keeps faces in frame. */
  imageClass?: string;
};

/** Chip photos are Jay's picks (2026-07-10), local in public/categories/. */
const CHIPS: CategoryChip[] = [
  {
    label: "Women",
    href: "/products?category=women",
    image: "/categories/women.jpg",
    alt: "Woman in a terracotta saree",
    imageClass: "object-[50%_22%]",
  },
  {
    label: "Men",
    href: "/products?category=men",
    image: "/categories/men.jpg",
    alt: "Man in a taupe knit seated on a wooden chair",
    imageClass: "object-[50%_20%]",
  },
  {
    label: "Kids",
    href: "/products?category=kids",
    image: "/categories/kids.jpg",
    alt: "Boy in a black tee and cream shorts",
    imageClass: "object-[50%_15%]",
  },
  {
    label: "Footwear",
    href: "/products?category=footwear",
    image: "/categories/footwear.jpg",
    alt: "Cream and navy sneakers",
  },
  {
    label: "Hot Picks",
    href: "/products?sort=popular",
    image: "/categories/hot-picks.jpg",
    alt: "Woman relaxing in an armchair with shopping bags",
  },
  {
    label: "Sale",
    href: "/products?sale=true",
  },
];

export function CategoryStrip() {
  return (
    <section className="border-b border-[#e6dac8] bg-white">
      <div className="section-frame py-10 sm:py-12">
        {/* Micro-eyebrow with flanking hairlines — quiet, editorial. */}
        <div className="mb-8 flex items-center justify-center gap-4">
          <span aria-hidden="true" className="h-px w-10 bg-[#e6dac8] sm:w-16" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#a48d78]">
            Shop by category
          </p>
          <span aria-hidden="true" className="h-px w-10 bg-[#e6dac8] sm:w-16" />
        </div>

        <StaggerGroup
          stagger={0.08}
          className="flex flex-wrap items-start justify-center gap-x-8 gap-y-7 sm:justify-between sm:gap-x-4"
        >
          {CHIPS.map((chip) => (
            <StaggerItem key={chip.label}>
              <Link
                href={chip.href}
                className="group flex w-20 flex-col items-center gap-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/40 sm:w-28"
              >
                {chip.image ? (
                  <span className="relative h-20 w-20 overflow-hidden rounded-full bg-[#f4f1ea] ring-1 ring-[#e6dac8] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:shadow-[0_18px_32px_-16px_rgba(164,141,120,0.65)] group-hover:ring-2 group-hover:ring-[#a48d78] sm:h-28 sm:w-28">
                    <Image
                      src={chip.image}
                      alt={chip.alt ?? chip.label}
                      fill
                      className={`object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110 ${chip.imageClass ?? ""}`}
                      sizes="112px"
                    />
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid h-20 w-20 place-items-center rounded-full bg-[#221b13] font-display text-[30px] italic leading-none text-[#faf9f6] ring-1 ring-[#221b13] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-[#a48d78] group-hover:shadow-[0_18px_32px_-16px_rgba(164,141,120,0.75)] group-hover:ring-[#a48d78] sm:h-28 sm:w-28 sm:text-[38px]"
                  >
                    %
                  </span>
                )}

                <span className="flex flex-col items-center">
                  <span className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#221b13] transition-colors duration-300 group-hover:text-[#a48d78] sm:text-[13px]">
                    {chip.label}
                  </span>
                  {/* Underline grows in from centre on hover. */}
                  <span
                    aria-hidden="true"
                    className="mt-1 block h-px w-0 bg-[#a48d78] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:w-full"
                  />
                </span>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
