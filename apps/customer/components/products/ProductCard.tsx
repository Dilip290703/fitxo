"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import type { FrontendProduct } from "@/lib/supabase/products";
import { WishlistButton } from "@/components/wishlist/WishlistButton";

/** Snitch-style catalogue card: flat image tile, plain heart, name + price. */
export function ProductCard({ product }: { product: FrontendProduct }) {
  const currentPrice = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(product.price),
    [product.price],
  );

  const oldPrice = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(product.oldPrice),
    [product.oldPrice],
  );

  return (
    <article className="group">
      <div className="relative aspect-[3/4] overflow-hidden bg-[#f4f1ea]">
        <Link
          href={`/product/${product.id}`}
          className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#221b13]/20"
        >
          {product.image ? (
            <Image
              src={product.image}
              alt={product.title}
              fill
              className="object-cover transition duration-500 group-hover:scale-[1.04]"
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-[12px] text-[#cbb9a4]">No image</span>
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
            displayPrice: currentPrice,
            displayOldPrice: oldPrice,
            color: "Default",
            size: product.sizeLabel,
            availability: "Available nearby",
          }}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full shadow-[0_4px_14px_-6px_rgba(34,27,19,0.4)] transition duration-200"
          defaultClassName="bg-white/90 text-[#221b13] backdrop-blur-sm hover:bg-white"
          filledClassName="bg-[#221b13] text-white"
        />

        {product.badge ? (
          <span className="absolute left-3 top-3 inline-flex bg-white/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#221b13] backdrop-blur-sm">
            {product.badge}
          </span>
        ) : null}
      </div>

      <div className="pt-3">
        <Link
          href={`/product/${product.id}`}
          className="line-clamp-1 text-[13px] leading-5 text-[#221b13] transition duration-200 hover:text-[#a48d78]"
          title={product.title}
        >
          {product.title}
        </Link>

        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-[14px] font-semibold text-[#221b13]">{currentPrice}</p>
          {product.oldPrice !== product.price ? (
            <p className="text-[12px] text-[#a48d78] line-through">{oldPrice}</p>
          ) : null}
        </div>

        {product.storeName ? (
          <p className="mt-1 truncate text-[11px] text-[#8a7a67]">
            {product.storeName}
          </p>
        ) : null}
      </div>
    </article>
  );
}
