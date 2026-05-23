import { RoutePlaceholder } from "@/components/RoutePlaceholder";

export default function TryTimerPage() {
  return (
    <RoutePlaceholder
      eyebrow="Try timer"
      title="Monitor your active try-at-home decision window."
      description="This route is reserved for active try-on countdowns, keep-or-return actions, and pickup scheduling."
      primaryLabel="Back to profile"
      primaryHref="/profile"
      secondaryLabel="My orders"
      secondaryHref="/orders"
    />
  );
}
