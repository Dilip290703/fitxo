"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckoutButton } from "@/components/cart/CheckoutButton";
import { useCart } from "@/components/cart/CartProvider";
import { useWishlist, type WishlistItem } from "@/store/wishlistStore";

export function WishlistCard({ item }: { item: WishlistItem }) {
  const { removeFromWishlist } = useWishlist();
  const { addItem, openDrawer } = useCart();

  return (
    <article className="group overflow-hidden rounded-[22px] border border-[#ece4da] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(20,20,20,0.08)]">
      <Link href={`/product/${item.id}`} className="block">
        <div className="relative h-[320px] overflow-hidden bg-[#f6f3ee]">
          <Image
            src={item.image}
            alt={item.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
          />
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              removeFromWishlist(item.id);
            }}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/80 text-[#1d2330] backdrop-blur-sm transition duration-200 hover:bg-white"
            aria-label="Remove from wishlist"
          >
            ×
          </button>
        </div>
      </Link>

      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] text-[#8b7058]">
            {item.brand}
          </p>
          <Link
            href={`/product/${item.id}`}
            className="mt-2 block text-[16px] leading-6 text-[#171717] transition duration-200 hover:text-black"
          >
            {item.title}
          </Link>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-[#171717]">
              {item.displayPrice}
            </p>
            <p className="mt-1 text-[12px] text-[#777169]">
              {item.availability ?? "Available nearby"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <CheckoutButton
            href="#"
            label="Move to Bag"
            onClick={() => {
              addItem({
                id: item.id,
                title: item.title,
                brand: item.brand,
                image: item.image,
                priceValue: item.priceValue,
                displayPrice: item.displayPrice,
                displayOldPrice: item.displayOldPrice,
                color: item.color ?? "Default",
                size: item.size ?? "M",
                quantity: 1,
              });
              removeFromWishlist(item.id);
              openDrawer();
            }}
          />
          <button
            type="button"
            onClick={() => removeFromWishlist(item.id)}
            className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#5f5851] transition duration-200 hover:text-black"
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}
