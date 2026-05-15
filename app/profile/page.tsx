import { ProfilePanel } from "@/components/ProfilePanel";
import { RoutePlaceholder } from "@/components/RoutePlaceholder";

export default function ProfilePage() {
  return (
    <RoutePlaceholder
      eyebrow="Your profile"
      title="Everything you saved for your next at-home try-on."
      description="Keep track of delivery areas, wishlisted looks, and upcoming try-before-you-buy orders."
      primaryLabel="Browse products"
      primaryHref="/products"
      secondaryLabel="Back to home"
      secondaryHref="/"
    >
      <ProfilePanel />
    </RoutePlaceholder>
  );
}
