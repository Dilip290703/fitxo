import Image from "next/image";
import Link from "next/link";
import { inr, type ConceptProduct } from "@/components/concept/shared";
import { CxReveal, CxRevealGroup, CxRiseChild } from "@/components/concept/CxReveal";
import { AutoVideo } from "@/components/concept/AutoVideo";

/**
 * "Shoppable Video" row (Fitxo landing). Each card autoplays a muted,
 * looping vertical clip from public/concept/video-N.mp4 with the product still
 * as the poster (so it looks right even before the clips are added). A small
 * product chip + name + price + Add-to-cart sits alongside. No play button —
 * videos play on their own.
 */
export function ShoppableVideo({ products }: { products: ConceptProduct[] }) {
  const cards = products.slice(0, 4);
  if (cards.length === 0) return null;

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-8">
        <CxReveal className="text-center">
          <h2 className="font-sans text-[clamp(2rem,4vw,3rem)] font-bold text-[#1a1a1a]">Shoppable Video</h2>
        </CxReveal>

        <CxRevealGroup className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((p, i) => (
            <CxRiseChild key={p.id}>
              <div className="group overflow-hidden rounded-[16px] border border-[#eee] bg-white shadow-[0_18px_44px_-28px_rgba(0,0,0,0.25)]">
                {/* aspect-[9/16] matches the source clips exactly, so the model
                    is never cropped (no cut-off heads). */}
                <div className="relative aspect-[9/16] overflow-hidden bg-[#f0eeeb]">
                  <AutoVideo
                    src={`/concept/video-${i + 1}.mp4`}
                    poster={p.image || undefined}
                    className="absolute inset-0 h-full w-full object-cover object-top"
                  />

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
            </CxRiseChild>
          ))}
        </CxRevealGroup>
      </div>
    </section>
  );
}
