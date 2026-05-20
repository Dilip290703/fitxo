"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M12.1 20.3l-.1.1-.11-.1C7 15.9 4 13.17 4 9.8 4 7.03 6.02 5 8.6 5c1.46 0 2.86.67 3.78 1.72C13.3 5.67 14.7 5 16.16 5 18.74 5 20.76 7.03 20.76 9.8c0 3.37-3 6.1-8.66 10.5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function RecommendedProducts({
  title,
  products,
  layout = "grid",
}: RecommendedProductsProps) {
  const [wishlistedIds, setWishlistedIds] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleWishlist = (id: string) => {
    setWishlistedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const cards = products.map((product) => {
    const wished = wishlistedIds.includes(product.id);

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
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleWishlist(product.id);
            }}
            className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/80 text-[#1d2330] backdrop-blur-sm transition duration-200 hover:bg-white ${
              wished ? "bg-[#1d2330] text-white" : ""
            }`}
            aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          >
            <HeartIcon filled={wished} />
          </button>
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
