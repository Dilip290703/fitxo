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
    <section id="testimonials" className="bg-[#fcfbf8] py-18">
      <div className="section-frame">
        <div className="mb-14 text-center">
          <h2 className="underlined-title font-display text-[36px] font-medium tracking-[-0.03em] text-black sm:text-[48px]">
            What Our Customers Say About Our Services
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleScroll(-320)}
            disabled={!canScrollLeft}
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#ddd7ce] text-[#7f776e] transition duration-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 lg:flex"
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
                className="card-shadow min-w-[280px] overflow-hidden rounded-[12px] border border-[#ece7de] bg-[#f5f0e8] p-4 transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_56px_rgba(24,24,28,0.12)] focus:outline-none focus:ring-2 focus:ring-[#1f2a3c]/20 md:min-w-[340px] lg:min-w-[360px]"
              >
                <div className="overflow-hidden rounded-[6px] bg-white">
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={720}
                    height={900}
                    className="h-[360px] w-full object-cover"
                  />
                </div>
                <div className="px-2 pb-2 pt-4">
                  <h3 className="text-center text-[18px] font-extrabold text-[#111111]">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-center text-[11px] uppercase tracking-[0.22em] text-[#756c62]">
                    {item.role}
                  </p>
                  <StarRow />
                  <p className="mt-4 text-[13px] leading-6 text-[#3f3c38]">
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
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#ddd7ce] text-[#7f776e] transition duration-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 lg:flex"
            aria-label="More testimonials"
          >
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
