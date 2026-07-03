import type { Metadata } from "next";
import { OnboardingView } from "@/components/onboarding/OnboardingView";

export const metadata: Metadata = { title: "Guide · FitZo Store" };

export default function GuidePage() {
  return <OnboardingView />;
}
