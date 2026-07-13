import Image from "next/image";
import Link from "next/link";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion";

type Brand = {
  name: string;
  slug: string;
  logo_url: string | null;
};

/**
 * "Shop by brand" — a responsive grid of the brands that actually exist in
 * the catalogue. This used to render 10 hardcoded mock brands, 9 of whose
 * `/brand/<slug>` links 404'd; every tile here now comes from the DB, so a
 * tile can only link to a brand page that resolves. The section is hidden by
 * FeaturedStores when the DB has no active brands.
 */
export function BrandCarousel({ brands }: { brands: Brand[] }) {
  return (
    <div className="mx-auto max-w-[1240px]">
      <Reveal className="mb-12 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a48d78]">
          Stores near you
        </p>
        <h2 className="mt-3 font-display text-3xl text-[#221b13] sm:text-4xl">
          Shop by brand
        </h2>
      </Reveal>

      <StaggerGroup
        amount={0.15}
        className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        {brands.map((brand) => (
          <StaggerItem key={brand.slug}>
          <Link
            href={`/brand/${brand.slug}`}
            className="group flex flex-col items-center justify-center gap-4 rounded-2xl border border-transparent bg-white px-4 py-10 text-center shadow-[0_10px_24px_-18px_rgba(34,27,19,0.25)] transition duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:border-[#e6dac8] hover:shadow-[0_28px_50px_-22px_rgba(164,141,120,0.5)] focus:outline-none focus:ring-2 focus:ring-[#221b13]/20"
          >
            {brand.logo_url ? (
              <span className="relative h-16 w-28">
                <Image
                  src={brand.logo_url}
                  alt={`${brand.name} logo`}
                  fill
                  className="object-contain transition duration-300 group-hover:scale-[1.06]"
                  sizes="112px"
                />
              </span>
            ) : (
              <span className="font-display text-[26px] font-semibold tracking-[-0.03em] text-black transition duration-300 group-hover:scale-[1.06]">
                {brand.name}
              </span>
            )}
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a48d78] transition duration-200 group-hover:text-[#221b13]">
              Shop {brand.name}
            </span>
          </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <div className="mt-12 flex justify-center">
        <Link
          href="/brands"
          className="inline-flex rounded-full bg-[#221b13] px-7 py-3 text-xs uppercase tracking-widest text-[#faf9f6] transition duration-200 hover:bg-[#3a2f22] focus:outline-none focus:ring-2 focus:ring-[#221b13]/20"
        >
          See more brands
        </Link>
      </div>
    </div>
  );
}
