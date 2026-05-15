"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

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

export function ProductCard({ product }: { product: Product }) {
  const [wishlisted, setWishlisted] = useState(false);
  const formattedPrice = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(product.price),
    [product.price],
  );

  return (
    <article className="group card-shadow overflow-hidden rounded-[10px] border border-[#ece6de] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(31,31,35,0.12)]">
      <Link
        href={`/product/${product.id}`}
        className="block focus:outline-none focus:ring-2 focus:ring-[#1f2a3c]/20"
      >
        <div className="relative h-[250px] overflow-hidden">
          <Image
            src={product.image}
            alt={product.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        </div>
      </Link>

      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#8a847c]">
              {product.subtitle}
            </p>
            <Link
              href={`/product/${product.id}`}
              className="mt-1 block text-[21px] font-extrabold leading-tight text-[#111111] transition duration-200 hover:text-[#3a3a3a]"
            >
              {product.title}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setWishlisted((current) => !current)}
            className={`mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border transition duration-200 ${
              wishlisted
                ? "border-[#111111] bg-[#111111] text-white"
                : "border-[#ddd2c5] bg-white text-[#3b362f] hover:border-[#111111]"
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

        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] uppercase tracking-[0.2em] text-[#7f776e]">
              {product.brand}
            </p>
            <p className="mt-1 text-[14px] font-semibold text-[#111111]">
              {formattedPrice}
            </p>
          </div>
          <Link
            href={`/product/${product.id}`}
            className="inline-flex h-9 items-center rounded-sm bg-[color:var(--soft-yellow)] px-4 text-[10px] font-extrabold uppercase tracking-[0.22em] text-black transition duration-300 hover:-translate-y-0.5 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#111111]/20"
          >
            Shop now
          </Link>
        </div>
      </div>
    </article>
  );
}
