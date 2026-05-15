import { RoutePlaceholder } from "@/components/RoutePlaceholder";

export default function CartPage() {
  return (
    <RoutePlaceholder
      eyebrow="Your cart"
      title="Your fitting-room shortlist lives here."
      description="Add a few pieces, compare them at home, and keep only what earns a spot in your wardrobe."
      primaryLabel="Browse products"
      primaryHref="/products"
      secondaryLabel="Back to home"
      secondaryHref="/"
    />
  );
}
