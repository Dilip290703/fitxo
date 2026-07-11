import Image from "next/image";
import Link from "next/link";
import { inr, CxIcon, type ConceptProduct } from "@/components/concept/shared";

/**
 * "Shoppable Video" row (ARLUNE reference). ARLUNE uses vertical video clips;
 * for the demo these are tall product stills with a play affordance + a small
 * product chip, name, price and Add-to-cart. Drop video-1..4.mp4 into
 * public/concept/ later to make them real (see page notes).
 */
export function ShoppableVideo({ products }: { products: ConceptProduct[] }) {
  const cards = products.slice(0, 4);
  if (cards.length === 0) return null;

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
        <h2 className="cx-rise text-center font-sans text-[clamp(2rem,4vw,3rem)] font-bold text-[#1a1a1a]">
          Shoppable Video
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-[16px] border border-[#eee] bg-white shadow-[0_18px_44px_-28px_rgba(0,0,0,0.25)]">
              <div className="group relative aspect-[3/5] overflow-hidden bg-[#f0eeeb]">
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.title}
                    fill
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 25vw"
                  />
                ) : null}
                {/* Play affordance (this is where a <video> goes once clips land) */}
                <span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/85 text-[#1a1a1a] backdrop-blur">
                  <CxIcon path="M8 5.5v13l10-6.5-10-6.5z" className="h-4 w-4" />
                </span>
                {/* Product chip */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-white/95 p-2 shadow-md">
                  <span className="relative h-11 w-9 overflow-hidden rounded bg-[#f0eeeb]">
                    {p.image ? <Image src={p.image} alt="" fill className="object-cover" sizes="36px" /> : null}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <h3 className="truncate text-[15px] font-medium text-[#1a1a1a]" title={p.title}>{p.title}</h3>
                <p className="mt-2 text-[16px] font-semibold text-[#1a1a1a]">{inr(p.price)}</p>
                <Link
                  href="/products"
                  className="mt-4 flex h-11 items-center justify-center bg-[#b0703f] text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#98602f]"
                >
                  Add to cart
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
