"use client";

import { BrandCarousel } from "@/components/BrandCarousel";
import { BrandsForYou } from "@/components/BrandsForYou";
import { ExperiencePreview } from "@/components/ExperiencePreview";
import { ProductGrid } from "@/components/ProductGrid";
import { products } from "@/lib/mockData";

export function FeaturedStores() {
  return (
    <section id="featured-stores">
      <div className="bg-[#f8f6f3] px-10 py-20">
        <BrandCarousel />
      </div>

      <ProductGrid
        title="This week's hot picks are HOT hot"
        description="From festive edits to streetwear staples, browse the styles nearby and schedule a doorstep fitting."
        products={products.slice(0, 4)}
      />

      <ExperiencePreview />
      <BrandsForYou />
    </section>
  );
}
