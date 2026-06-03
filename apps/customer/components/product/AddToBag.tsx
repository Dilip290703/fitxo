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
  /** Pass true when the selected size exists but is currently sold out */
  isSoldOutSize?: boolean;
};

export function AddToBag({ product, selectedSize, isSoldOutSize = false }: AddToBagProps) {
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

  // ── Button label ──────────────────────────────────────────────────────────
  const buttonLabel = (() => {
    if (!selectedSize) return "Select a Size";
    if (added) return "Added to Bag ✓";
    if (isSoldOutSize) return "Add to Bag — Notify Me";
    return "Add to Bag";
  })();

  // ── Button style ──────────────────────────────────────────────────────────
  const buttonClass = (extraClass = "") => {
    let colorClass = "";
    if (!selectedSize) {
      colorClass = "cursor-not-allowed bg-[#b8b0a7]";
    } else if (added) {
      colorClass = "bg-[#2e7d32] hover:bg-[#256427]";
    } else if (isSoldOutSize) {
      colorClass = "bg-[#555047] hover:bg-[#3e3a34]"; // muted dark to signal sold-out
    } else {
      colorClass = "bg-[#171d2b] hover:bg-[#0f1522]";
    }
    return `rounded-[16px] px-6 py-4 text-[14px] font-semibold uppercase tracking-[0.08em] text-white transition duration-300 ${colorClass} ${extraClass}`;
  };

  const isDisabled = !selectedSize;

  return (
    <>
      {/* Sold-out notice — only shown when selected size is out of stock */}
      {isSoldOutSize && selectedSize && (
        <p className="rounded-[12px] bg-[#fff8e1] px-4 py-2.5 text-[12px] text-[#856d00]">
          <strong>{selectedSize}</strong> is currently sold out. You can still add to bag
          — we&apos;ll notify you when it&apos;s back in stock.
        </p>
      )}

      {/* Desktop: quantity stepper + button */}
      <div className="hidden gap-4 sm:flex sm:items-center">
        <div className="flex items-center rounded-[14px] border border-[#ddd4c9] bg-white">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={isDisabled}
            className="h-12 w-12 text-[20px] text-[#403c37] transition duration-200 hover:bg-[#faf5ee] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-10 text-center text-[14px] font-medium text-[#171717]">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            disabled={isDisabled}
            className="h-12 w-12 text-[20px] text-[#403c37] transition duration-200 hover:bg-[#faf5ee] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={isDisabled}
          className={buttonClass("flex-1")}
        >
          {buttonLabel}
        </button>
      </div>

      {/* Mobile inline button */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={handleAdd}
          disabled={isDisabled}
          className={buttonClass("w-full")}
        >
          {buttonLabel}
        </button>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8dfd5] bg-[#fbfaf7]/95 px-4 py-3 backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={handleAdd}
          disabled={isDisabled}
          className={buttonClass("w-full")}
        >
          {buttonLabel}
        </button>
      </div>
    </>
  );
}
