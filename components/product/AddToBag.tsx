"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";

type AddToBagProps = {
  product: {
    id: string;
    title: string;
    brand: string;
    image: string;
    priceValue: number;
    displayPrice: string;
    displayOldPrice?: string;
    selectedColor: string;
  };
  selectedSize: string;
};

export function AddToBag({ product, selectedSize }: AddToBagProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    if (!selectedSize) return;
    addItem({
      id: product.id,
      title: product.title,
      brand: product.brand,
      image: product.image,
      priceValue: product.priceValue,
      displayPrice: product.displayPrice,
      displayOldPrice: product.displayOldPrice,
      color: product.selectedColor,
      size: selectedSize,
      quantity,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <>
      <div className="hidden gap-4 sm:flex sm:items-center">
        <div className="flex items-center rounded-[14px] border border-[#ddd4c9] bg-white">
          <button
            type="button"
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            className="h-12 w-12 text-[20px] text-[#403c37] transition duration-200 hover:bg-[#faf5ee]"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-10 text-center text-[14px] font-medium text-[#171717]">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((current) => current + 1)}
            className="h-12 w-12 text-[20px] text-[#403c37] transition duration-200 hover:bg-[#faf5ee]"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!selectedSize}
          className="flex-1 rounded-[16px] bg-black px-6 py-4 text-[14px] font-semibold uppercase tracking-[0.08em] text-white transition duration-300 hover:bg-[#1e1e1e] disabled:cursor-not-allowed disabled:bg-[#b8b0a7]"
        >
          {added ? "Added to Bag" : "Add to Bag"}
        </button>
      </div>

      <div className="sm:hidden">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!selectedSize}
          className="w-full rounded-[16px] bg-black px-6 py-4 text-[14px] font-semibold uppercase tracking-[0.08em] text-white transition duration-300 hover:bg-[#1e1e1e] disabled:cursor-not-allowed disabled:bg-[#b8b0a7]"
        >
          {added ? "Added to Bag" : "Add to Bag"}
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8dfd5] bg-[#fbfaf7]/95 px-4 py-3 backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!selectedSize}
          className="w-full rounded-[16px] bg-black px-6 py-4 text-[14px] font-semibold uppercase tracking-[0.08em] text-white transition duration-300 hover:bg-[#1e1e1e] disabled:cursor-not-allowed disabled:bg-[#b8b0a7]"
        >
          {added ? "Added to Bag" : "Add to Bag"}
        </button>
      </div>
    </>
  );
}
