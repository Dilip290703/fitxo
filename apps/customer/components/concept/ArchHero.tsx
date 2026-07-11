"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CxIcon, CX_ICONS } from "@/components/concept/shared";

/**
 * Arched full-bleed hero slider (ARLUNE reference): domed image, a vertical
 * "GET 15% OFF" rail + "COMPARE" tab on the left edge, prev/next arrows, and
 * dot nav. Content is FITZO. Auto-advances (respects reduced-motion).
 */
export type HeroSlide = {
  image: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
};

const INTERVAL = 5000;

export function ArchHero({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((c) => (c + 1) % count), INTERVAL);
    return () => clearInterval(t);
  }, [count]);

  if (count === 0) return null;
  const go = (d: number) => setActive((c) => (c + d + count) % count);

  return (
    <section className="relative bg-white px-3 pb-6 pt-4 sm:px-5">
      {/* Left edge rails */}
      <div className="pointer-events-none absolute left-2 top-0 z-20 flex h-full flex-col items-center justify-between py-10 text-[#1a1a1a]">
        <span className="pointer-events-auto flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] [writing-mode:vertical-lr]">
          Compare <span className="grid h-5 w-5 place-items-center rounded-full bg-[#1a1a1a] text-[10px] text-white">0</span>
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b0703f] [writing-mode:vertical-lr]">
          Get 15% off
        </span>
      </div>

      <div className="relative mx-auto max-w-[1500px] overflow-hidden cx-arch">
        <div className="relative aspect-[16/10] w-full sm:aspect-[16/8]">
          {slides.map((s, i) => (
            <div
              key={i}
              className={`absolute inset-0 transition-opacity duration-700 ${i === active ? "opacity-100" : "opacity-0"}`}
            >
              {s.image ? (
                <Image
                  src={s.image}
                  alt={s.title}
                  fill
                  priority={i === 0}
                  className="object-cover"
                  sizes="100vw"
                />
              ) : (
                <div className="h-full w-full bg-[#d9d4cc]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/5 to-transparent" />
            </div>
          ))}

          {/* Copy */}
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-[560px] px-8 sm:px-16">
              <p className="text-[13px] font-semibold uppercase tracking-[0.24em] text-white/90">
                {slides[active].eyebrow}
              </p>
              <h1 className="mt-4 font-sans text-[clamp(2.4rem,6vw,4.6rem)] font-black uppercase leading-[0.98] tracking-[-0.02em] text-white">
                {slides[active].title}
              </h1>
              <p className="mt-4 max-w-[420px] text-[15px] leading-7 text-white/85">
                {slides[active].body}
              </p>
              <button className="mt-8 inline-flex h-12 items-center border border-white/70 bg-transparent px-8 text-[12px] font-semibold uppercase tracking-[0.18em] text-white transition duration-300 hover:bg-white hover:text-[#1a1a1a]">
                {slides[active].cta}
              </button>
            </div>
          </div>
        </div>

        {/* Arrows */}
        {count > 1 ? (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Previous"
              className="absolute left-5 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#1a1a1a] shadow transition hover:bg-white"
            >
              <CxIcon path={CX_ICONS.arrowLeft} className="h-5 w-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next"
              className="absolute right-5 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#1a1a1a] shadow transition hover:bg-white"
            >
              <CxIcon path={CX_ICONS.arrowRight} className="h-5 w-5" />
            </button>
          </>
        ) : null}

        {/* Dots */}
        {count > 1 ? (
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-7 bg-white" : "w-1.5 bg-white/55"}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
