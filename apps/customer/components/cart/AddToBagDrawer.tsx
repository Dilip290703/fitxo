"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { CartDeliveryInfo } from "@/components/cart/DeliveryInfo";
import { CartItem } from "@/components/cart/CartItem";
import { RecommendedProducts } from "@/components/cart/RecommendedProducts";
import { useCart } from "@/components/cart/CartProvider";
import { useLiveRecommendations } from "@/components/cart/useLiveRecommendations";

export function AddToBagDrawer() {
  const { isDrawerOpen, closeDrawer, items, latestItem } = useCart();

  useEffect(() => {
    if (!isDrawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerOpen]);

  const bagIds = useMemo(() => items.map((item) => item.id), [items]);
  const recommendedProducts = useLiveRecommendations(4, bagIds);

  return (
    <div
      className={`fixed inset-0 z-50 transition duration-300 ${
        isDrawerOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!isDrawerOpen}
    >
      <div
        onClick={closeDrawer}
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition duration-300 ${
          isDrawerOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl transition duration-300 ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#ece4da] px-5 py-4">
          <button
            type="button"
            onClick={closeDrawer}
            className="text-[26px] font-light leading-none text-[#1f1f1f] transition duration-200 hover:text-black"
            aria-label="Close bag drawer"
          >
            ×
          </button>
          <p className="text-[16px] font-semibold text-[#171717]">
            Added to Bag
          </p>
          <Link
            href="/bag"
            onClick={closeDrawer}
            className="rounded-[12px] bg-black px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] !text-white visited:!text-white hover:!text-white transition duration-200 hover:opacity-90"
          >
            View Bag
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <CartDeliveryInfo />

          <div className="mt-5">
            {latestItem ? (
              <CartItem item={latestItem} compact />
            ) : (
              <div className="rounded-[20px] border border-[#ece4da] bg-[#fbfaf7] px-4 py-5 text-[14px] text-[#5f5851]">
                Your bag is empty for now.
              </div>
            )}
          </div>

          {recommendedProducts.length > 0 ? (
            <div className="mt-6">
              <RecommendedProducts
                title="You May Also Like"
                products={recommendedProducts}
                layout="grid"
              />
            </div>
          ) : null}
        </div>

        <div className="border-t border-[#ece4da] px-5 py-4">
          <Link
            href="/bag"
            onClick={closeDrawer}
            className="inline-flex w-full items-center justify-center rounded-[16px] bg-black px-6 py-4 text-[14px] font-semibold uppercase tracking-[0.08em] !text-white visited:!text-white hover:!text-white transition duration-300 hover:opacity-90"
          >
            View Bag
          </Link>
          <p className="mt-3 text-center text-[12px] text-[#706961]">
            {items.length} {items.length === 1 ? "item" : "items"} ready for try-on checkout
          </p>
        </div>
      </aside>
    </div>
  );
}
