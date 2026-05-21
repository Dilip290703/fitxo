"use client";

import Image from "next/image";
import { CartItem as CartItemType, useCart } from "@/components/cart/CartProvider";
import { useWishlist } from "@/store/wishlistStore";

type CartItemProps = {
  item: CartItemType;
  compact?: boolean;
};

export function CartItem({ item, compact = false }: CartItemProps) {
  const { removeItem, moveToWishlist, updateQuantity } = useCart();
  const { addToWishlist } = useWishlist();

  return (
    <article
      className={`rounded-[20px] border border-[#ece4da] bg-white ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex gap-4">
        <div
          className={`relative shrink-0 overflow-hidden rounded-[16px] bg-[#f6f3ee] ${
            compact ? "h-[112px] w-[92px]" : "h-[148px] w-[118px]"
          }`}
        >
          <Image
            src={item.image}
            alt={item.title}
            fill
            className="object-cover"
            sizes={compact ? "92px" : "118px"}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] uppercase tracking-[0.12em] text-[#8b7058]">
                {item.brand}
              </p>
              <h3 className="mt-2 text-[15px] font-medium leading-6 text-[#171717]">
                {item.title}
              </h3>
              <p className="mt-2 text-[13px] text-[#5f5851]">
                {item.color} · Size {item.size}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[15px] font-semibold text-[#171717]">
                {item.displayPrice}
              </p>
              {item.displayOldPrice ? (
                <p className="mt-1 text-[12px] text-[#99928a] line-through">
                  {item.displayOldPrice}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center rounded-[12px] border border-[#ddd4c9] bg-[#fbfaf7]">
              <button
                type="button"
                onClick={() => updateQuantity(item.key, item.quantity - 1)}
                className="h-10 w-10 text-[18px] text-[#403c37] transition duration-200 hover:bg-[#faf5ee]"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="w-10 text-center text-[13px] font-medium text-[#171717]">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(item.key, item.quantity + 1)}
                className="h-10 w-10 text-[18px] text-[#403c37] transition duration-200 hover:bg-[#faf5ee]"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-4 text-[12px] font-medium uppercase tracking-[0.06em] text-[#4f4942]">
              <button
                type="button"
                onClick={() => {
                  addToWishlist({
                    id: item.id,
                    title: item.title,
                    brand: item.brand,
                    image: item.image,
                    priceValue: item.priceValue,
                    displayPrice: item.displayPrice,
                    displayOldPrice: item.displayOldPrice,
                    color: item.color,
                    size: item.size,
                    availability: "Available nearby",
                  });
                  moveToWishlist(item.key);
                }}
                className="transition duration-200 hover:text-black"
              >
                Move to Wishlist
              </button>
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                className="transition duration-200 hover:text-black"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
