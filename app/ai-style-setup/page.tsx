import { RoutePlaceholder } from "@/components/RoutePlaceholder";

export default function AIStyleSetupPage() {
  return (
    <RoutePlaceholder
      eyebrow="AI style preferences"
      title="Fine-tune your size, fit, shade, and brand profile."
      description="The profile dashboard links here for a future AI style setup flow with measurements, undertone, favorite categories, and preferred brands."
      primaryLabel="Back to profile"
      primaryHref="/profile"
      secondaryLabel="Browse products"
      secondaryHref="/products"
    />
  );
}
