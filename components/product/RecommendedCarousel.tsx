"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { WishlistButton } from "@/components/wishlist/WishlistButton";

type RecommendedProduct = {
  id: string;
  title: string;
  price: number;
  image: string;
};

function Arrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${direction === "right" ? "rotate-180" : ""}`}
    >
      <path
        d="M15 6l-6 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function RecommendedCarousel({
  products,
}: {
  products: RecommendedProduct[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section className="bg-[#fcfaf7] py-16">
      <div className="section-frame">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
              You may also like
            </p>
            <h2 className="mt-3 font-display text-[38px] leading-none text-[#171717]">
              Curated nearby for your next try-on.
            </h2>
          </div>

          <div className="hidden gap-3 sm:flex">
            <button
              type="button"
              onClick={() => scrollByAmount(-320)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#ddd4c9] bg-white text-[#1d2330] transition duration-200 hover:bg-[#faf5ee]"
              aria-label="Scroll left"
            >
              <Arrow direction="left" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount(320)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#ddd4c9] bg-white text-[#1d2330] transition duration-200 hover:bg-[#faf5ee]"
              aria-label="Scroll right"
            >
              <Arrow direction="right" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="hide-scrollbar flex gap-5 overflow-x-auto scroll-smooth"
        >
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              className="min-w-[240px] overflow-hidden rounded-[22px] border border-[#ece4da] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(20,20,20,0.08)]"
            >
              <div className="relative h-[280px] overflow-hidden">
                <Image
                  src={product.image}
                  alt={product.title}
                  fill
                  className="object-cover transition duration-500 hover:scale-[1.04]"
                  sizes="240px"
                />
                <WishlistButton
                  item={{
                    id: product.id,
                    title: product.title,
                    brand: "FitZo Select",
                    image: product.image,
                    priceValue: product.price,
                    displayPrice: `₹${Math.round(product.price)}`,
                    availability: "Available nearby",
                  }}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-[#1d2330] backdrop-blur-sm transition duration-200"
                  defaultClassName="bg-white/80 hover:bg-white"
                  filledClassName="bg-[#1d2330] text-white"
                />
              </div>
              <div className="px-4 py-4">
                <p className="line-clamp-2 text-[14px] leading-6 text-[#171717]">
                  {product.title}
                </p>
                <p className="mt-3 text-[14px] font-semibold text-[#171717]">
                  ₹{product.price}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
