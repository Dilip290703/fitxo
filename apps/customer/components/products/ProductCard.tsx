"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import type { FrontendProduct } from "@/lib/supabase/products";
import { WishlistButton } from "@/components/wishlist/WishlistButton";

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
    <article className="group overflow-hidden border border-[#eee7de] bg-white shadow-[0_4px_12px_rgba(16,16,16,0.03)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(16,16,16,0.08)]">
      <Link
        href={`/product/${product.id}`}
        className="block focus:outline-none focus:ring-2 focus:ring-[#1f2a3c]/20"
      >
        <div className="relative h-[262px] overflow-hidden sm:h-[298px]">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.title}
              fill
              className="object-cover transition duration-500 group-hover:scale-[1.04]"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <div className="h-full w-full bg-[#f0ece4]" />
          )}
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
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center border border-white/25 text-white backdrop-blur-sm transition duration-200"
            defaultClassName="bg-[#5f716f]/70 hover:bg-[#465754]/85"
            filledClassName="bg-[#1e293b]"
          />
        </div>
      </Link>

      <div className="px-3 pb-4 pt-3">
        <Link
          href={`/product/${product.id}`}
          className="line-clamp-2 text-[13px] leading-5 text-[#1e1e1e] transition duration-200 hover:text-[#4d4d4d]"
        >
          {product.title}
        </Link>

        {product.storeName ? (
          <p className="mt-1 truncate text-[11px] text-[#8b8178]">🏪 {product.storeName}</p>
        ) : null}

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-[#202020]">
              {currentPrice}
            </p>
            {product.oldPrice !== product.price ? (
              <p className="mt-1 text-[12px] text-[#a3a09c] line-through">
                {oldPrice}
              </p>
            ) : null}
          </div>
          {product.orders > 0 ? (
            <p className="text-[12px] text-[#66615a]">{product.orders} Orders</p>
          ) : null}
        </div>

        {product.badge ? (
          <div className="mt-3">
            <span className="inline-flex bg-[#171d2b] px-2.5 py-1 text-[10px] text-white">
              {product.badge}
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
