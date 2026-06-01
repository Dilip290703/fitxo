import Link from "next/link";
import { brandLogoLinks } from "@/lib/mockData";

type BrandLink = { name: string; slug: string };

export function BrandsForYou({ brands }: { brands?: BrandLink[] }) {
  const displayBrands = brands ?? brandLogoLinks;

  return (
    <div className="bg-white py-14 sm:py-16">
      <div className="section-frame text-center">
        <p className="font-display text-[24px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a]">
          Brands for you
        </p>
        <div className="mx-auto mt-2 h-px w-16 bg-[#1c1c1c]" />

        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {displayBrands.map((brand) => (
            <Link
              key={brand.slug}
              href={`/brand/${brand.slug}`}
              className="flex h-14 items-center justify-center text-center font-display text-[27px] font-semibold tracking-[-0.03em] text-black opacity-100 transition duration-200 hover:scale-105 hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-[#111111]/20"
            >
              {brand.name}
            </Link>
          ))}
        </div>

        <Link
          href="/brands"
          className="mt-11 inline-flex h-12 items-center rounded-[6px] bg-[#cfeafb] px-8 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#16344f] shadow-[0_18px_34px_rgba(154,205,238,0.55)] transition duration-300 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#16344f]/20"
        >
          View all stores
        </Link>
      </div>
    </div>
  );
}
