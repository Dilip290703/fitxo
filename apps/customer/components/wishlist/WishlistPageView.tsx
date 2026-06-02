"use client";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { EmptyWishlist } from "@/components/wishlist/EmptyWishlist";
import { WishlistGrid } from "@/components/wishlist/WishlistGrid";
import { useWishlist } from "@/store/wishlistStore";

export function WishlistPageView() {
  const { items, count } = useWishlist();

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <Navbar />

      <section className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
            Wishlist
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="font-display text-[46px] leading-none text-[#171717]">
              Saved for later
            </h1>
            <p className="text-[14px] text-[#5f5851]">
              {count} {count === 1 ? "item" : "items"} in your wishlist
            </p>
          </div>
        </div>

        {items.length === 0 ? <EmptyWishlist /> : <WishlistGrid items={items} />}
      </section>

      <Footer />
    </main>
  );
}
