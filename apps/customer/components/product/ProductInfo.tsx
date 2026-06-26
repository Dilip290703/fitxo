"use client";

import { useMemo, useState } from "react";
import { AccordionSection } from "@/components/product/AccordionSection";
import { AddToBag } from "@/components/product/AddToBag";
import { ColorSelector } from "@/components/product/ColorSelector";
import { DeliveryInfo } from "@/components/product/DeliveryInfo";
import { NearbyStores } from "@/components/product/NearbyStores";
import { OfferCards } from "@/components/product/OfferCards";
import { Reviews } from "@/components/product/Reviews";
import { SizeSelector } from "@/components/product/SizeSelector";
import { ProductDetailData } from "@/components/product/types";

export function ProductInfo({ product }: { product: ProductDetailData }) {
  const [selectedColor, setSelectedColor] = useState(product.colors[0]?.name ?? "");
  // Pre-select first AVAILABLE size; fall back to first size if all are sold out.
  // Sold-out sizes remain selectable so users can still add / request restock.
  const [selectedSize, setSelectedSize] = useState<string>(
    () => (product.sizes.find((s) => s.available) ?? product.sizes[0])?.label ?? "",
  );
  const [openSection, setOpenSection] = useState<"details" | "reviews" | "delivery" | "returns" | null>("details");

  // Is the currently-selected size out of stock?
  const isSoldOutSize =
    !!selectedSize &&
    product.sizes.some((s) => s.label === selectedSize && !s.available);

  const selectedColorValue = useMemo(
    () =>
      product.colors.find((color) => color.name === selectedColor)?.value ??
      selectedColor,
    [product.colors, selectedColor],
  );

  return (
    <section className="space-y-7 lg:sticky lg:top-28">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#8b7058]">
              {product.brand}
            </p>
            <h1 className="mt-2 text-[28px] font-medium leading-tight text-[#171717]">
              {product.title}
            </h1>
            {product.storeName ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#f3efe8] px-3 py-1 text-[12px] font-medium text-[#5c5650]">
                <span aria-hidden>🏪</span> Sold by {product.storeName}
              </p>
            ) : null}
            <p className="mt-3 text-[14px] leading-7 text-[#5c5650]">
              {product.subtitle}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-[30px] font-semibold text-[#171717]">
              {product.price}
            </p>
            {product.oldPrice ? (
              <div className="mt-1 flex items-center gap-2 sm:justify-end">
                <span className="text-[14px] text-[#99928a] line-through">
                  {product.oldPrice}
                </span>
                {product.discount ? (
                  <span className="text-[13px] font-medium text-[#c26751]">
                    {product.discount}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <OfferCards offers={product.offers} />
      </div>

      <ColorSelector
        colors={product.colors}
        selectedColor={selectedColor}
        onChange={setSelectedColor}
      />

      <SizeSelector
        sizes={product.sizes}
        selectedSize={selectedSize}
        onChange={setSelectedSize}
      />

      <DeliveryInfo />

      <AddToBag
        selectedSize={selectedSize}
        isSoldOutSize={isSoldOutSize}
        product={{
          id: product.id,
          title: product.title,
          brand: product.brand,
          image: product.gallery[0]?.src ?? "",
          priceValue: product.priceValue,
          displayPrice: product.price,
          displayOldPrice: product.oldPrice,
          selectedColor,
        }}
      />

      <div className="rounded-[22px] bg-[#f4ede4] p-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
          Try first, pay later
        </p>
        <p className="mt-3 text-[16px] font-medium text-[#171717]">
          Try on at your door before paying.
        </p>
        <p className="mt-3 text-[14px] leading-7 text-[#5f5851]">
          Book a delivery slot, try your picks on while the rider waits, and hand back anything that doesn&apos;t feel right on the spot.
        </p>
      </div>

      <div className="rounded-[22px] border border-[#ece3d8] bg-white px-5">
        <AccordionSection
          title="Details"
          open={openSection === "details"}
          onToggle={() =>
            setOpenSection((current) => (current === "details" ? null : "details"))
          }
        >
          <ul className="space-y-2">
            {product.details.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </AccordionSection>

        <AccordionSection
          title="Reviews"
          open={openSection === "reviews"}
          onToggle={() =>
            setOpenSection((current) => (current === "reviews" ? null : "reviews"))
          }
        >
          <Reviews reviews={product.reviews} />
        </AccordionSection>

        <AccordionSection
          title="Delivery"
          open={openSection === "delivery"}
          onToggle={() =>
            setOpenSection((current) => (current === "delivery" ? null : "delivery"))
          }
        >
          <ul className="space-y-2">
            {product.delivery.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </AccordionSection>

        <AccordionSection
          title="Returns"
          open={openSection === "returns"}
          onToggle={() =>
            setOpenSection((current) => (current === "returns" ? null : "returns"))
          }
        >
          <ul className="space-y-2">
            {product.returns.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </AccordionSection>
      </div>

      <NearbyStores stores={product.nearbyStores} />

      <div className="rounded-[22px] border border-[#ece3d8] bg-white px-5 py-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b7058]">
          Selected color
        </p>
        <p className="mt-2 text-[14px] leading-7 text-[#5c5650]">
          {selectedColor} · {selectedColorValue}
        </p>
      </div>
    </section>
  );
}
