import Image from "next/image";
import Link from "next/link";

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
      <div className="mb-12 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b8378]">
          Stores near you
        </p>
        <h2 className="mt-3 font-serif text-3xl text-gray-900 sm:text-4xl">
          Shop by brand
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {brands.map((brand) => (
          <Link
            key={brand.slug}
            href={`/brand/${brand.slug}`}
            className="group flex flex-col items-center justify-center gap-4 rounded-2xl bg-white px-4 py-10 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_44px_-18px_rgba(24,24,28,0.28)] focus:outline-none focus:ring-2 focus:ring-[#1f2a3c]/20"
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
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b8378] transition duration-200 group-hover:text-[#1f2a3c]">
              Shop {brand.name}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <Link
          href="/brands"
          className="inline-flex rounded-md bg-yellow-400 px-6 py-3 text-xs uppercase tracking-widest text-black transition duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#111111]/20"
        >
          See more brands
        </Link>
      </div>
    </div>
  );
}
