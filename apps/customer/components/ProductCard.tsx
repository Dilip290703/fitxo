"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { WishlistButton } from "@/components/wishlist/WishlistButton";

type Product = {
  id: string;
  title: string;
  subtitle: string;
  brand: string;
  brandSlug: string;
  category: string;
  price: number;
  sale: boolean;
  collection: string;
  image: string;
  /** Average review rating (0–5). Only rendered when real reviews exist. */
  rating?: number;
  /** Count of real reviews backing `rating`. No reviews → no star row. */
  reviewCount?: number;
};

/** 5-star row with half-star support (e.g. 4.5). */
function StarRow({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <span className="flex text-[13px] leading-none text-[#a48d78]">
        {Array.from({ length: 5 }).map((_, index) => {
          const fill =
            rating >= index + 1 ? 1 : rating >= index + 0.5 ? 0.5 : 0;
          return (
            <span key={index} className="relative inline-block" aria-hidden="true">
              <span className="text-[#e6dac8]">★</span>
              {fill > 0 ? (
                <span
                  className="absolute inset-y-0 left-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  ★
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
      <span className="text-[11px] text-[#8a7a67]">({count})</span>
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const formattedPrice = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(product.price),
    [product.price],
  );

  const hasRealRating =
    typeof product.rating === "number" &&
    typeof product.reviewCount === "number" &&
    product.reviewCount > 0;

  return (
    <article className="group">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-[#f4f1ea]">
        <Link
          href={`/product/${product.id}`}
          className="relative block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#221b13]/20"
        >
          {product.image ? (
            <Image
              src={product.image}
              alt={product.title}
              fill
              className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-[13px] text-[#cbb9a4]">No image</span>
            </div>
          )}
        </Link>

        <WishlistButton
          item={{
            id: product.id,
            title: product.title,
            brand: product.brand,
            image: product.image,
            priceValue: product.price,
            displayPrice: formattedPrice,
            availability: "Available nearby",
          }}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full shadow-[0_6px_16px_-6px_rgba(34,27,19,0.35)] transition duration-200"
          defaultClassName="bg-white/90 text-[#221b13] backdrop-blur-sm hover:bg-white"
          filledClassName="bg-[#221b13] text-white"
        />
      </div>

      <div className="pt-3.5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#a48d78]">
          {product.brand}
        </p>
        <Link
          href={`/product/${product.id}`}
          className="mt-1 block truncate text-[14px] font-medium leading-snug text-[#221b13] transition duration-200 hover:text-[#a48d78]"
          title={product.title}
        >
          {product.title}
        </Link>
        <p className="mt-1 text-[14px] font-semibold text-[#221b13]">
          {formattedPrice}
        </p>
        {hasRealRating ? (
          <StarRow rating={product.rating!} count={product.reviewCount!} />
        ) : null}
      </div>
    </article>
  );
}
