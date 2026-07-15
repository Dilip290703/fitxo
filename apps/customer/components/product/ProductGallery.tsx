"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ThumbnailRail } from "@/components/product/ThumbnailRail";
import { ProductDetailData } from "@/components/product/types";
import { WishlistButton } from "@/components/wishlist/WishlistButton";

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${direction === "right" ? "rotate-180" : ""}`}
    >
      <path
        d="M15 6l-6 6 6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M12 16V4m0 0l-4 4m4-4l4 4M6 14v4h12v-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80";

export function ProductGallery({ product }: { product: ProductDetailData }) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Guard: always have at least one gallery item to prevent crash
  const gallery = product.gallery.length > 0
    ? product.gallery
    : [{ id: "placeholder", src: PLACEHOLDER_IMAGE, alt: product.title }];

  const activeImage = useMemo(
    () => gallery[activeIndex] ?? gallery[0],
    [activeIndex, gallery],
  );

  const changeImage = (direction: "prev" | "next") => {
    setActiveIndex((current) => {
      if (direction === "prev") {
        return current === 0 ? gallery.length - 1 : current - 1;
      }
      return current === gallery.length - 1 ? 0 : current + 1;
    });
  };

  return (
    <section className="self-start grid gap-4 lg:grid-cols-[92px_minmax(0,1fr)] lg:gap-6">
      <ThumbnailRail
        images={gallery}
        activeIndex={activeIndex}
        onChange={setActiveIndex}
      />

      <div className="relative self-start overflow-hidden rounded-[28px] border border-[#ece4da] bg-white">
        <div className="relative h-auto max-h-[820px] aspect-[3/4] w-full overflow-hidden bg-[#f6f3ee]">
          <Image
            key={activeImage.id}
            src={activeImage.src}
            alt={activeImage.alt}
            fill
            className="object-cover object-top transition duration-700 hover:scale-[1.03]"
            sizes="(max-width: 1024px) 100vw, 58vw"
            priority
          />

          <div className="absolute right-4 top-4 z-10 flex flex-col gap-3">
            <WishlistButton
              item={{
                id: product.id,
                title: product.title,
                brand: product.brand,
                image: gallery[0]?.src ?? activeImage.src,
                priceValue: product.priceValue,
                displayPrice: product.price,
                displayOldPrice: product.oldPrice,
                color: product.colors[0]?.name,
                size: product.sizes[0]?.label,
                availability: "Available nearby",
                storeId: product.storeId,
                storeName: product.storeName,
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/35 text-[#1d2330] backdrop-blur-sm transition duration-200"
              defaultClassName="bg-white/75 hover:bg-white"
              filledClassName="bg-[#1d2330] text-white"
              iconClassName="h-5 w-5"
            />
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/75 text-[#1d2330] backdrop-blur-sm transition duration-200 hover:bg-white"
              aria-label="Share product"
            >
              <ShareIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={() => changeImage("prev")}
            className="absolute bottom-6 left-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#8e8e8e]/75 text-white transition duration-200 hover:bg-[#6f6f6f]/85"
            aria-label="Previous image"
          >
            <ArrowIcon direction="left" />
          </button>

          <button
            type="button"
            onClick={() => changeImage("next")}
            className="absolute bottom-6 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#8e8e8e]/75 text-white transition duration-200 hover:bg-[#6f6f6f]/85"
            aria-label="Next image"
          >
            <ArrowIcon direction="right" />
          </button>
        </div>
      </div>
    </section>
  );
}
