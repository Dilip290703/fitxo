"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogProduct } from "@/lib/mockData";

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

export function ProductCard({ product }: { product: CatalogProduct }) {
  const [wishlisted, setWishlisted] = useState(false);

  const currentPrice = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(product.price),
    [product.price],
  );

  const oldPrice = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
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
          <Image
            src={product.image}
            alt={product.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setWishlisted((current) => !current);
            }}
            className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center border border-white/25 bg-[#5f716f]/70 text-white backdrop-blur-sm transition duration-200 hover:bg-[#465754]/85 ${
              wishlisted ? "bg-[#1e293b]" : ""
            }`}
            aria-label={
              wishlisted
                ? `Remove ${product.title} from wishlist`
                : `Add ${product.title} to wishlist`
            }
          >
            <HeartIcon filled={wishlisted} />
          </button>
        </div>
      </Link>

      <div className="px-3 pb-4 pt-3">
        <Link
          href={`/product/${product.id}`}
          className="line-clamp-2 text-[13px] leading-5 text-[#1e1e1e] transition duration-200 hover:text-[#4d4d4d]"
        >
          {product.title}
        </Link>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-[#202020]">
              {currentPrice}
            </p>
            <p className="mt-1 text-[12px] text-[#a3a09c] line-through">
              {oldPrice}
            </p>
          </div>
          <p className="text-[12px] text-[#66615a]">{product.orders} Orders</p>
        </div>

        <div className="mt-3">
          <span className="inline-flex bg-[#171d2b] px-2.5 py-1 text-[10px] text-white">
            {product.badge}
          </span>
        </div>
      </div>
    </article>
  );
}
