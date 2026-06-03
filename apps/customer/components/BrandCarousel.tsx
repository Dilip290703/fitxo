"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { brands } from "@/lib/mockData";

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M15 6l-6 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
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

function BrandBanner({
  name,
  logo,
  containerClass,
  logoClass,
}: {
  name: string;
  logo: string;
  containerClass: string;
  logoClass: string;
}) {
  return (
    <div
      className={`mt-4 flex h-[70px] w-full items-center justify-center overflow-hidden rounded-xl ${containerClass}`}
    >
      <img src={logo} alt={`${name} logo`} className={logoClass} />
    </div>
  );
}

export function BrandCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateScrollState = () => {
      setCanScrollLeft(element.scrollLeft > 8);
      setCanScrollRight(
        element.scrollLeft + element.clientWidth < element.scrollWidth - 8,
      );
    };

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      element.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  const scrollByAmount = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-[1240px] text-center">
      <h2 className="mb-12 text-center font-serif text-3xl text-gray-900">
        Shop by brand
      </h2>

      <div className="relative">
        <button
          type="button"
          onClick={() => scrollByAmount(-300)}
          disabled={!canScrollLeft}
          className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition duration-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 md:flex"
          aria-label="Scroll brands left"
        >
          <ArrowLeftIcon />
        </button>

        <div
          ref={scrollRef}
          className="hide-scrollbar flex gap-6 overflow-x-auto scroll-smooth px-1"
        >
          {brands.map((brand) => (
            <Link
              key={brand.slug}
              href={`/brand/${brand.slug}`}
              className="group min-w-[180px] rounded-2xl bg-white p-4 text-left shadow-sm transition duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1f2a3c]/20 sm:min-w-[210px] lg:min-w-[240px]"
            >
              <div className="relative h-[260px] w-full overflow-hidden rounded-xl">
                <Image
                  src={brand.image}
                  alt={brand.name}
                  fill
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                  sizes="(max-width: 640px) 180px, (max-width: 1024px) 210px, 240px"
                />
              </div>
              <BrandBanner
                name={brand.name}
                logo={brand.logo}
                containerClass={brand.containerClass}
                logoClass={brand.logoClass}
              />
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollByAmount(300)}
          disabled={!canScrollRight}
          className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition duration-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 md:flex"
          aria-label="Scroll brands right"
        >
          <ArrowRightIcon />
        </button>
      </div>

      <div className="mt-12 flex justify-center">
        <Link
          href="/brands"
          className="inline-flex rounded-md bg-yellow-400 px-6 py-3 text-xs uppercase tracking-widest text-black transition duration-200 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#111111]/20"
        >
          See more brands
        </Link>
      </div>
    </div>
  );
}
