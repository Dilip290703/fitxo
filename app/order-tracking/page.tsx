import { RoutePlaceholder } from "@/components/RoutePlaceholder";

export default function OrderTrackingPage() {
  return (
    <RoutePlaceholder
      eyebrow="Order tracking"
      title="Live delivery tracking is ready for rider updates."
      description="This placeholder keeps the customer account flow complete until real order status, route, and ETA data are integrated."
      primaryLabel="Back to profile"
      primaryHref="/profile"
      secondaryLabel="My orders"
      secondaryHref="/orders"
    />
  );
}
