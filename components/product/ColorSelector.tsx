"use client";

import Image from "next/image";
import { ProductColor } from "@/components/product/types";

type ColorSelectorProps = {
  colors: ProductColor[];
  selectedColor: string;
  onChange: (value: string) => void;
};

export function ColorSelector({
  colors,
  selectedColor,
  onChange,
}: ColorSelectorProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#171717]">
          Colors
        </p>
        <p className="text-[12px] text-[#6c655e]">{selectedColor}</p>
      </div>

      <div className="mt-4 flex gap-3">
        {colors.map((color) => (
          <button
            key={color.name}
            type="button"
            onClick={() => onChange(color.name)}
            className={`relative h-[74px] w-[60px] overflow-hidden rounded-[14px] border bg-white transition duration-200 hover:border-[#1d2330]/50 ${
              selectedColor === color.name
                ? "border-[#1d2330]"
                : "border-[#ece4da]"
            }`}
          >
            <Image
              src={color.preview}
              alt={color.name}
              fill
              className="object-cover"
              sizes="60px"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
