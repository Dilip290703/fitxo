import { RoutePlaceholder } from "@/components/RoutePlaceholder";

export default function TryTimerPage() {
  return (
    <RoutePlaceholder
      eyebrow="Try timer"
      title="Monitor your active try-on window at the door."
      description="This route is reserved for the live try-on countdown and keep-or-return actions while your rider waits."
      primaryLabel="Back to profile"
      primaryHref="/profile"
      secondaryLabel="My orders"
      secondaryHref="/orders"
    />
  );
}
