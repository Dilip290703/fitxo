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
  oldPrice?: number;
};

type RecommendedProductsProps = {
  title: string;
  products: RecommendedProduct[];
  layout?: "grid" | "carousel";
};

export function RecommendedProducts({
  title,
  products,
  layout = "grid",
}: RecommendedProductsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const cards = products.map((product) => {
    return (
      <Link
        key={product.id}
        href={`/product/${product.id}`}
        className="group overflow-hidden rounded-[18px] border border-[#ece4da] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(20,20,20,0.08)]"
      >
        <div className="relative h-[210px] overflow-hidden bg-[#f6f3ee]">
          <Image
            src={product.image}
            alt={product.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
            sizes={layout === "grid" ? "(max-width: 768px) 50vw, 180px" : "260px"}
          />
          <WishlistButton
            item={{
              id: product.id,
              title: product.title,
              brand: "FitXo Select",
              image: product.image,
              priceValue: product.price,
              displayPrice: `₹${Math.round(product.price)}`,
              displayOldPrice: product.oldPrice
                ? `₹${Math.round(product.oldPrice)}`
                : undefined,
              availability: "Available nearby",
            }}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 text-[#1d2330] backdrop-blur-sm transition duration-200"
            defaultClassName="bg-white/80 hover:bg-white"
            filledClassName="bg-[#1d2330] text-white"
          />
          <div className="absolute bottom-0 inset-x-0 bg-black/85 px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white">
            Limited Drop
          </div>
        </div>
        <div className="px-3 py-3">
          <p className="line-clamp-2 text-[13px] leading-5 text-[#171717]">
            {product.title}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[#171717]">
              ₹{Math.round(product.price)}
            </span>
            {product.oldPrice ? (
              <span className="text-[12px] text-[#99928a] line-through">
                ₹{Math.round(product.oldPrice)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    );
  });

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[22px] font-display leading-none text-[#171717]">
          {title}
        </h3>
        {layout === "carousel" ? (
          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scrollRef.current?.scrollBy({ left: -280, behavior: "smooth" })}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd4c9] bg-white text-[#1d2330] transition duration-200 hover:bg-[#faf5ee]"
              aria-label="Scroll left"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scrollRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd4c9] bg-white text-[#1d2330] transition duration-200 hover:bg-[#faf5ee]"
              aria-label="Scroll right"
            >
              →
            </button>
          </div>
        ) : null}
      </div>

      {layout === "grid" ? (
        <div className="grid grid-cols-2 gap-4">{cards}</div>
      ) : (
        <div
          ref={scrollRef}
          className="hide-scrollbar flex gap-4 overflow-x-auto scroll-smooth"
        >
          {cards.map((card, index) => (
            <div key={index} className="min-w-[240px] sm:min-w-[260px]">
              {card}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
