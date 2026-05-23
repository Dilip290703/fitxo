import { RoutePlaceholder } from "@/components/RoutePlaceholder";

export default function OrdersPage() {
  return (
    <RoutePlaceholder
      eyebrow="My orders"
      title="Track active try-ons and past Fitzo deliveries."
      description="Order history is mocked for now. Backend order APIs can connect here when checkout and delivery tracking are wired."
      primaryLabel="Back to profile"
      primaryHref="/profile"
      secondaryLabel="Browse products"
      secondaryHref="/products"
    />
  );
}
