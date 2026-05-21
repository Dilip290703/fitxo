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
};

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
            className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border transition duration-200"
            defaultClassName="border-[#ddd2c5] bg-white text-[#3b362f] hover:border-[#111111]"
            filledClassName="border-[#111111] bg-[#111111] text-white"
          />
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
