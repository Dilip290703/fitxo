"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DeliveryFlowModal } from "@/components/DeliveryFlowModal";

/** The three beats of the Fitzo promise, shown as a mini feature row under the CTAs. */
const FLOW_STEPS = [
  { label: "Book a slot", detail: "Pick your delivery window" },
  { label: "Try at your door", detail: "Rider waits while you fit" },
  { label: "Keep what fits", detail: "Pay only for that" },
];

/** Rotating hero imagery — the right column cycles through these vertically.
    Files live in public/hero/ (sourced from Jay's reference pins). */
const HERO_SLIDES = [
  {
    src: "/hero/slide-1.jpg",
    alt: "Man in a cream knit and white trousers",
  },
  {
    src: "/hero/slide-2.jpg",
    alt: "Woman in a brown off-shoulder top and cream trousers",
  },
  {
    src: "/hero/slide-3.jpg",
    alt: "Three women in embroidered sarees",
  },
];

const SLIDE_INTERVAL_MS = 4500;

function ArrowGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M5 12h13m-5-6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5">
      <path d="M8 5.5v13l10-6.5-10-6.5z" fill="currentColor" />
    </svg>
  );
}

/**
 * Right-column carousel: a track 3× the container height slides up one
 * viewport per beat; the 01/02/03 rail mirrors the active slide and is
 * clickable. Auto-advance respects prefers-reduced-motion.
 */
function HeroCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(
      () => setActive((current) => (current + 1) % HERO_SLIDES.length),
      SLIDE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          height: `${HERO_SLIDES.length * 100}%`,
          transform: `translateY(-${(active * 100) / HERO_SLIDES.length}%)`,
        }}
      >
        {HERO_SLIDES.map((slide, index) => (
          <div
            key={slide.src}
            className="relative w-full"
            style={{ height: `${100 / HERO_SLIDES.length}%` }}
          >
            <Image
              src={slide.src}
              alt={index === active ? slide.alt : ""}
              fill
              className="object-cover object-top"
              sizes="(max-width: 1024px) 100vw, 44vw"
              priority={index === 0}
            />
          </div>
        ))}
      </div>

      {/* Numbered rail — mirrors the active slide, like the reference's 01/02/03. */}
      <div className="absolute right-5 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-3">
        {HERO_SLIDES.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => setActive(index)}
            aria-label={`Show hero image ${index + 1}`}
            aria-current={index === active}
            className="flex flex-col items-center gap-3"
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-full text-[11px] tracking-[0.08em] backdrop-blur-md transition duration-500 ${
                index === active
                  ? "bg-[#221b13]/85 font-semibold text-[#faf9f6]"
                  : "bg-white/70 text-[#221b13]/70 hover:bg-white/90 hover:text-[#221b13]"
              }`}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            {index < HERO_SLIDES.length - 1 ? (
              <span
                aria-hidden="true"
                className={`block w-px transition-all duration-500 ${
                  index === active ? "h-7 bg-[#221b13]/60" : "h-3.5 bg-[#221b13]/25"
                }`}
              />
            ) : null}
          </button>
        ))}
      </div>

    </div>
  );
}

export function Hero() {
  const [isFlowOpen, setIsFlowOpen] = useState(false);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#f4f1ea]">
        {/* Soft warm wash behind the copy — decorative only. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="hero-bloom hero-bloom--gold absolute -left-32 top-[-10%] h-[520px] w-[520px] rounded-full opacity-[0.35] blur-[120px]" />
          <div className="hero-bloom hero-bloom--blue absolute bottom-[-20%] left-[28%] h-[460px] w-[460px] rounded-full opacity-[0.14] blur-[120px]" />
        </div>

        <div className="grid min-h-[88vh] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_44%]">
          {/* ---------- Copy column ---------- */}
          <div className="relative flex items-center px-6 py-20 sm:px-10 lg:px-16 xl:px-24">
            <div className="hero-stagger w-full max-w-[560px]">
              <span
                className="hero-item inline-flex items-center gap-2 rounded-full border border-[#a48d78]/40 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a48d78]"
                style={{ "--i": 0 } as React.CSSProperties}
              >
                <span className="hero-pulse h-1.5 w-1.5 rounded-full bg-[#a48d78]" />
                Now delivering in Pune
              </span>

              <h1
                className="hero-item mt-7 font-display text-[clamp(2.75rem,6vw,4.6rem)] font-medium leading-[1.05] tracking-[-0.015em] text-[#221b13]"
                style={{ "--i": 1 } as React.CSSProperties}
              >
                <span className="block">Try before</span>
                <span className="block">
                  you{" "}
                  <span className="hero-underline relative inline-block italic text-[#a48d78]">
                    buy.
                  </span>
                </span>
              </h1>

              <p
                className="hero-item mt-6 max-w-[430px] text-[15px] leading-[1.75] text-[#6f6050]"
                style={{ "--i": 2 } as React.CSSProperties}
              >
                Browse collections from stores near you. A rider brings your picks
                to the door and{" "}
                <span className="font-medium text-[#221b13]">waits while you try them on</span>
                {" "}— keep what you love, hand the rest straight back.
              </p>

              {/* CTAs */}
              <div
                className="hero-item mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
                style={{ "--i": 3 } as React.CSSProperties}
              >
                {/* Luxury "wipe" hover: a light panel sweeps in from the left
                    and the label inverts — no colour morphing. */}
                <Link
                  href="/products"
                  className="group relative inline-flex h-[52px] items-center justify-center gap-3 overflow-hidden rounded-full border border-[#221b13] bg-[#221b13] px-8 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#faf9f6] shadow-[0_16px_36px_-14px_rgba(34,27,19,0.6)] transition-colors duration-500 hover:text-[#221b13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#221b13] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f1ea]"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 -translate-x-full rounded-full bg-[#faf9f6] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"
                  />
                  <span className="relative z-10">Shop now</span>
                  <span className="relative z-10 transition-transform duration-500 group-hover:translate-x-1">
                    <ArrowGlyph />
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsFlowOpen(true)}
                  className="group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-full border border-[#cbb9a4] px-7 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6f6050] transition duration-300 hover:border-[#a48d78] hover:bg-white/60 hover:text-[#221b13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a48d78]/50"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#221b13] text-[#faf9f6] transition group-hover:bg-[#a48d78]">
                    <PlayGlyph />
                  </span>
                  Watch delivery flow
                </button>
              </div>

              {/* Promise row — replaces the old standalone trust strip. */}
              <ol
                className="hero-item mt-12 flex flex-wrap items-start gap-x-8 gap-y-5 border-t border-[#e6dac8] pt-7"
                style={{ "--i": 4 } as React.CSSProperties}
              >
                {FLOW_STEPS.map((step, index) => (
                  <li key={step.label} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#cbb9a4] bg-white text-[11px] font-semibold text-[#a48d78]">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-[13px] font-medium leading-tight text-[#221b13]">
                        {step.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-[#8a7a67]">
                        {step.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* ---------- Image column ---------- */}
          <div className="relative isolate min-h-[420px] overflow-hidden lg:min-h-full">
            <HeroCarousel />
          </div>
        </div>
      </section>

      <DeliveryFlowModal isOpen={isFlowOpen} onClose={() => setIsFlowOpen(false)} />
    </>
  );
}
