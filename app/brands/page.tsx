import { BrandCarousel } from "@/components/BrandCarousel";
import { RoutePlaceholder } from "@/components/RoutePlaceholder";

export default function BrandsPage() {
  return (
    <RoutePlaceholder
      eyebrow="Brand directory"
      title="Every nearby brand in one polished view."
      description="Browse the labels available for same-day discovery, at-home try-on, and pay-later checkout."
      primaryLabel="Back to home"
      primaryHref="/"
      secondaryLabel="See products"
      secondaryHref="/products"
    >
      <BrandCarousel />
    </RoutePlaceholder>
  );
}
