"use client";

import Image from "next/image";
import { ProductGalleryImage } from "@/components/product/types";

type ThumbnailRailProps = {
  images: ProductGalleryImage[];
  activeIndex: number;
  onChange: (index: number) => void;
};

export function ThumbnailRail({
  images,
  activeIndex,
  onChange,
}: ThumbnailRailProps) {
  return (
    <div className="hide-scrollbar flex gap-3 overflow-x-auto lg:max-h-[860px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
      {images.map((image, index) => {
        // Never render a thumbnail without a valid src — it crashes next/image
        if (!image.src) return null;
        return (
          <button
            key={image.id || `thumb-${index}`}
            type="button"
            onClick={() => onChange(index)}
            className={`relative h-[88px] w-[72px] shrink-0 overflow-hidden rounded-[14px] border bg-white transition duration-200 hover:border-[#1d2330]/50 sm:h-[110px] sm:w-[88px] ${
              activeIndex === index
                ? "border-[#1d2330] shadow-[0_8px_20px_rgba(20,20,20,0.08)]"
                : "border-[#ece4da]"
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-cover"
              sizes="88px"
            />
          </button>
        );
      })}
    </div>
  );
}
