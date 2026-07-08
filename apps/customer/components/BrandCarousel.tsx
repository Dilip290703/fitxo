import Image from "next/image";
import Link from "next/link";
import { brands } from "@/lib/mockData";

function BrandBanner({
  name,
  logo,
  containerClass,
  logoClass,
}: {
  name: string;
  logo: string;
  containerClass: string;
  logoClass: string;
}) {
  return (
    <div
      className={`mt-4 flex h-[70px] w-full items-center justify-center overflow-hidden rounded-xl ${containerClass}`}
    >
      <img src={logo} alt={`${name} logo`} className={logoClass} />
    </div>
  );
}

/**
 * "Shop by brand" — a responsive grid (was a horizontal carousel; brands are a
 * browse surface, not a reel, so every brand should be reachable without
 * scrubbing sideways).
 */
export function BrandCarousel() {
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
            className="group rounded-2xl bg-white p-4 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_44px_-18px_rgba(24,24,28,0.28)] focus:outline-none focus:ring-2 focus:ring-[#1f2a3c]/20"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[#f2efe9]">
              <Image
                src={brand.image}
                alt={brand.name}
                fill
                className="object-cover transition duration-500 group-hover:scale-[1.06]"
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, (max-width: 1280px) 23vw, 220px"
              />
              {/* Wash that lifts on hover — keeps the logo legible over busy shots. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition duration-300 group-hover:opacity-100"
              />
            </div>
            <BrandBanner
              name={brand.name}
              logo={brand.logo}
              containerClass={brand.containerClass}
              logoClass={brand.logoClass}
            />
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
