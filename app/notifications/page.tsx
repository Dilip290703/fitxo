import { RoutePlaceholder } from "@/components/RoutePlaceholder";

export default function NotificationsPage() {
  return (
    <RoutePlaceholder
      eyebrow="Notifications"
      title="Control delivery, offer, wishlist, and style alerts."
      description="Notification preferences are mocked until account settings and messaging providers are connected."
      primaryLabel="Back to profile"
      primaryHref="/profile"
      secondaryLabel="Contact support"
      secondaryHref="/contact"
    />
  );
}
