import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion";

/**
 * Dual promo banner row (reference: "Spring Sale" / "Fresh Styles Just Landed").
 *
 * DUMMY CONTENT for now — each entry is shaped like the future `banners`
 * table row (admin-controlled: Admin > Banners will own eyebrow/title/CTA/
 * image/href/active). Swap this const for a Supabase query when that lands.
 */
const DUMMY_BANNERS = [
  {
    id: "sale",
    eyebrow: "Limited time offer",
    titleLines: ["Season Sale", "Up to 50% Off"],
    cta: "Shop The Sale",
    href: "/products?sale=true",
    image:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Woman in a beige trench coat",
  },
  {
    id: "new-arrivals",
    eyebrow: "New arrivals",
    titleLines: ["Fresh Styles", "Just Landed"],
    cta: "Explore New In",
    href: "/products",
    image:
      "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&w=900&q=80",
    imageAlt: "Neutral-toned garments on wooden hangers",
  },
];

export function PromoBanners() {
  return (
    <section className="bg-[color:var(--background)] py-14 sm:py-16">
      <div className="section-frame grid gap-6 lg:grid-cols-2">
        {DUMMY_BANNERS.map((banner, index) => (
          <Reveal
            key={banner.id}
            delay={index * 0.12}
            className="group relative flex min-h-[240px] items-center overflow-hidden rounded-[20px] border border-[#e6dac8] bg-[#f4f1ea] transition-shadow duration-500 hover:shadow-[0_32px_60px_-30px_rgba(164,141,120,0.55)]"
          >
            <div className="relative z-10 max-w-[58%] px-8 py-10 sm:px-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a48d78]">
                {banner.eyebrow}
              </p>
              <h3 className="mt-3 font-display text-[26px] font-medium leading-[1.15] tracking-[-0.01em] text-[#221b13] sm:text-[32px]">
                {banner.titleLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </h3>
              <Link
                href={banner.href}
                className="group mt-6 inline-flex h-11 items-center gap-2.5 rounded-full bg-[#221b13] px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#faf9f6] transition duration-300 hover:-translate-y-0.5 hover:bg-[#3a2f22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#221b13]/40"
              >
                {banner.cta}
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5">
                  <path
                    d="M5 12h13m-5-6l6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </Link>
            </div>

            <div className="absolute inset-y-0 right-0 w-[46%]">
              <Image
                src={banner.image}
                alt={banner.imageAlt}
                fill
                className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
                sizes="(max-width: 1024px) 46vw, 23vw"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-[#f4f1ea] via-[#f4f1ea]/30 to-transparent"
              />
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
