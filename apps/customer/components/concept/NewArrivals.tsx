import Image from "next/image";
import Link from "next/link";
import type { ConceptProduct } from "@/components/concept/shared";

/**
 * "NEW ARRIVALS" — four tall category tiles with item counts (ARLUNE
 * reference). Uses live catalogue products as the imagery.
 */
export function NewArrivals({ products }: { products: ConceptProduct[] }) {
  const tiles = products.slice(0, 4);
  if (tiles.length === 0) return null;

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
        <div className="cx-rise text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-[#b0703f]">
            Premium Active
          </p>
          <h2 className="mt-3 font-sans text-[clamp(2rem,4vw,3rem)] font-black uppercase tracking-[-0.01em] text-[#1a1a1a]">
            New Arrivals
          </h2>
          <p className="mx-auto mt-4 max-w-[620px] text-[15px] leading-7 text-[#6b6b6b]">
            Fresh picks from stores near you — book a slot and try them on at your
            door before you decide.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {tiles.map((p, i) => (
            <Link key={p.id} href="/products" className="group text-center">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] bg-[#f0eeeb]">
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.title}
                    fill
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                ) : null}
              </div>
              <h3 className="mt-5 text-[19px] font-medium text-[#1a1a1a] transition group-hover:text-[#b0703f]">
                {p.title}
              </h3>
              <p className="mt-1 text-[14px] text-[#8a8a8a]">{4 + ((i * 3) % 9)} Items</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
