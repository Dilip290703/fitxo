"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { CxIcon, CX_ICONS } from "@/components/concept/shared";

/**
 * Full-bleed ARLUNE "Trends & Look" hero: image bleeds edge-to-edge, copy sits
 * in the RIGHT column over a soft light gradient, with the left-edge
 * GET 15% OFF + COMPARE rails, circular arrows and dot nav. Auto-advances,
 * Ken-Burns zoom on the active slide, animated copy on change.
 */
export type HeroSlide = {
  image: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
};

const INTERVAL = 5500;

export function ArchHero({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const count = slides.length;

  useEffect(() => {
    if (count <= 1 || reduce) return;
    const t = setInterval(() => setActive((c) => (c + 1) % count), INTERVAL);
    return () => clearInterval(t);
  }, [count, reduce]);

  if (count === 0) return null;
  const go = (d: number) => setActive((c) => (c + d + count) % count);
  const s = slides[active];

  return (
    <section className="relative h-[86vh] min-h-[560px] w-full overflow-hidden bg-[#d9d4cc]">
      {/* Slides */}
      {slides.map((slide, i) => (
        <div key={i} className={`absolute inset-0 transition-opacity duration-[900ms] ${i === active ? "opacity-100" : "opacity-0"}`}>
          {slide.image ? (
            <Image
              src={slide.image}
              alt={slide.title}
              fill
              priority={i === 0}
              className={`object-cover object-center ${reduce ? "" : "cx-kenburns"}`}
              sizes="100vw"
            />
          ) : null}
        </div>
      ))}

      {/* Light gradient on the right so dark copy reads on any image */}
      <div className="absolute inset-0 bg-gradient-to-l from-white/85 via-white/25 to-transparent" />

      {/* Left-edge rails */}
      <div className="absolute left-3 top-0 z-20 flex h-full flex-col items-center justify-between py-12 text-[#1a1a1a]">
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] [writing-mode:vertical-lr]">
          Compare <span className="grid h-5 w-5 place-items-center rounded-full bg-[#1a1a1a] text-[10px] text-white">0</span>
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b0703f] [writing-mode:vertical-lr]">
          Get 15% off
        </span>
      </div>

      {/* Copy — right column */}
      <div className="absolute inset-0 z-10 flex items-center">
        <div className="ml-auto w-full max-w-[1400px] px-8 lg:px-16">
          <div className="ml-auto max-w-[520px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                // Transform-only enter: copy must stay visible even if the
                // animation clock never advances. Exit may fade — its failure
                // mode is "stays visible", never "stays hidden".
                initial={reduce ? false : { y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="text-[13px] font-semibold uppercase tracking-[0.26em] text-[#b0703f]">{s.eyebrow}</p>
                <h1 className="mt-4 font-sans text-[clamp(2.6rem,6vw,5rem)] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#1a1a1a]">
                  {s.title}
                </h1>
                <p className="mt-5 max-w-[420px] text-[15px] leading-7 text-[#4a4a4a]">{s.body}</p>
                <button className="mt-8 inline-flex h-12 items-center border border-[#1a1a1a] px-9 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#1a1a1a] transition duration-300 hover:bg-[#1a1a1a] hover:text-white">
                  {s.cta}
                </button>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Arrows */}
      {count > 1 ? (
        <>
          <button onClick={() => go(-1)} aria-label="Previous" className="absolute left-6 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#1a1a1a] shadow-lg transition hover:bg-white">
            <CxIcon path={CX_ICONS.arrowLeft} />
          </button>
          <button onClick={() => go(1)} aria-label="Next" className="absolute right-6 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#1a1a1a] shadow-lg transition hover:bg-white">
            <CxIcon path={CX_ICONS.arrowRight} />
          </button>
        </>
      ) : null}

      {/* Dots */}
      {count > 1 ? (
        <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-8 bg-[#1a1a1a]" : "w-1.5 bg-[#1a1a1a]/40"}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
