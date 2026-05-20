"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ThumbnailRail } from "@/components/product/ThumbnailRail";
import { ProductDetailData } from "@/components/product/types";

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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M12.1 20.3l-.1.1-.11-.1C7 15.9 4 13.17 4 9.8 4 7.03 6.02 5 8.6 5c1.46 0 2.86.67 3.78 1.72C13.3 5.67 14.7 5 16.16 5 18.74 5 20.76 7.03 20.76 9.8c0 3.37-3 6.1-8.66 10.5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
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

export function ProductGallery({ product }: { product: ProductDetailData }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);

  const activeImage = useMemo(
    () => product.gallery[activeIndex] ?? product.gallery[0],
    [activeIndex, product.gallery],
  );

  const changeImage = (direction: "prev" | "next") => {
    setActiveIndex((current) => {
      if (direction === "prev") {
        return current === 0 ? product.gallery.length - 1 : current - 1;
      }

      return current === product.gallery.length - 1 ? 0 : current + 1;
    });
  };

  return (
    <section className="self-start grid gap-4 lg:grid-cols-[92px_minmax(0,1fr)] lg:gap-6">
      <ThumbnailRail
        images={product.gallery}
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
            <button
              type="button"
              onClick={() => setWishlisted((current) => !current)}
              className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/75 text-[#1d2330] backdrop-blur-sm transition duration-200 hover:bg-white ${
                wishlisted ? "bg-[#1d2330] text-white" : ""
              }`}
              aria-label={
                wishlisted ? "Remove from wishlist" : "Add to wishlist"
              }
            >
              <HeartIcon filled={wishlisted} />
            </button>
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
