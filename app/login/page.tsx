import { LoginPanel } from "@/components/LoginPanel";
import { RoutePlaceholder } from "@/components/RoutePlaceholder";

export default function LoginPage() {
  return (
    <RoutePlaceholder
      eyebrow="Welcome back"
      title="Sign in for saved looks, delivery updates, and quicker checkout."
      description="This demo login keeps the homepage account flow, navbar routing, and profile page behaving like a real marketplace."
      primaryLabel="Browse products"
      primaryHref="/products"
      secondaryLabel="Back to home"
      secondaryHref="/"
    >
      <LoginPanel />
    </RoutePlaceholder>
  );
}
