"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { testimonials } from "@/lib/mockData";

function StarRow() {
  return (
    <div className="mt-3 flex items-center justify-center gap-1 text-[#f8c833]">
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} aria-hidden="true">
          ★
        </span>
      ))}
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function Testimonials() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateState = () => {
      setCanScrollLeft(element.scrollLeft > 8);
      setCanScrollRight(
        element.scrollLeft + element.clientWidth < element.scrollWidth - 8,
      );
    };

    updateState();
    element.addEventListener("scroll", updateState, { passive: true });
    window.addEventListener("resize", updateState);

    return () => {
      element.removeEventListener("scroll", updateState);
      window.removeEventListener("resize", updateState);
    };
  }, []);

  const handleScroll = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section
      id="testimonials"
      className="relative isolate overflow-hidden bg-[#fcfbf8] py-18"
    >
      {/* Colour behind the glass — without something to refract, a frosted panel
          just reads as grey. These blooms give the blur something to pick up. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-10 h-[420px] w-[420px] rounded-full bg-[#ffd233] opacity-[0.18] blur-[130px]" />
        <div className="absolute -right-20 bottom-0 h-[380px] w-[380px] rounded-full bg-[#7fa9d9] opacity-[0.16] blur-[130px]" />
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-[#e8b4a0] opacity-[0.12] blur-[120px]" />
      </div>

      <div className="section-frame">
        <div className="mb-14 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b8378]">
            Feedback
          </p>
          <h2 className="underlined-title mt-3 font-display text-[36px] font-medium tracking-[-0.03em] text-black sm:text-[48px]">
            What Our Customers Say About Our Services
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleScroll(-320)}
            disabled={!canScrollLeft}
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/40 text-[#5c554d] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md transition duration-300 hover:bg-white/75 hover:text-[#1f2a3c] disabled:cursor-not-allowed disabled:opacity-40 lg:flex"
            aria-label="Previous testimonials"
          >
            <span className="rotate-180">
              <ArrowRightIcon />
            </span>
          </button>

          <div
            ref={scrollRef}
            className="hide-scrollbar flex flex-1 gap-5 overflow-x-auto scroll-smooth"
          >
            {testimonials.map((item) => (
              <Link
                key={item.id}
                href="/reviews"
                className="group min-w-[280px] overflow-hidden rounded-[18px] border border-white/60 bg-white/45 p-4 shadow-[0_8px_32px_rgba(24,24,28,0.07),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-150 transition duration-300 hover:-translate-y-1.5 hover:border-white/80 hover:bg-white/60 hover:shadow-[0_30px_56px_rgba(24,24,28,0.14),inset_0_1px_0_rgba(255,255,255,0.9)] focus:outline-none focus:ring-2 focus:ring-[#1f2a3c]/20 md:min-w-[340px] lg:min-w-[360px]"
              >
                <div className="overflow-hidden rounded-[12px] bg-white/50">
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={720}
                    height={900}
                    className="h-[360px] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="px-2 pb-2 pt-4">
                  <h3 className="text-center text-[18px] font-extrabold text-[#111111]">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-center text-[11px] uppercase tracking-[0.22em] text-[#6b635a]">
                    {item.role}
                  </p>
                  <StarRow />
                  <p className="mt-4 text-[13px] leading-6 text-[#33312e]">
                    {item.quote}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleScroll(320)}
            disabled={!canScrollRight}
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/40 text-[#5c554d] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md transition duration-300 hover:bg-white/75 hover:text-[#1f2a3c] disabled:cursor-not-allowed disabled:opacity-40 lg:flex"
            aria-label="More testimonials"
          >
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
