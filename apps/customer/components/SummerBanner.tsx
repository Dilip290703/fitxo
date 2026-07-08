"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export function SummerBanner() {
  const router = useRouter();

  const handleNavigate = () => {
    router.push("/products?collection=summer");
  };

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="section-frame">
        <div
          role="link"
          tabIndex={0}
          onClick={handleNavigate}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleNavigate();
            }
          }}
          className="relative h-[300px] w-full cursor-pointer overflow-hidden rounded-2xl outline-none transition duration-300 focus:ring-2 focus:ring-[#1f3a5f]/20 sm:h-[420px]"
        >
          <Image
            src="https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1500&q=80"
            alt="Summer collection"
            fill
            className="scale-x-[-1] object-cover object-right"
            sizes="100vw"
            priority={false}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#8fb3d1] via-[#8fb3d1]/60 to-transparent" />

          <div className="absolute left-6 top-1/2 -translate-y-1/2 space-y-6 sm:left-16">
            <div className="leading-tight">
              <p className="font-display text-2xl text-[#1f3a5f] sm:text-4xl">
                Summer
              </p>
              <p className="font-display text-3xl text-[#e74c3c] sm:text-5xl">
                Collections
              </p>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleNavigate();
              }}
              className="inline-flex items-center rounded-sm bg-white px-6 py-3 text-xs tracking-widest text-black transition duration-300 hover:bg-[#f4f4f4] focus:outline-none focus:ring-2 focus:ring-white/60"
            >
              <span>SHOP NOW</span>
              <span className="ml-3">→</span>
            </button>
          </div>

          {/* The old countdown here was hardcoded (07:08:04:05, never ticked,
              never ended) — fake urgency. No sale-end date exists in config;
              re-add a timer only when the banner CMS carries a real one. */}
          <p className="absolute bottom-6 left-6 text-[13px] uppercase tracking-[0.18em] text-white/90 sm:left-16">
            Doorstep try-on · Pay only for keeps
          </p>
        </div>
      </div>
    </section>
  );
}
