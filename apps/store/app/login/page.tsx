import type { Metadata } from "next";
import { StoreLoginPanel } from "@/components/StoreLoginPanel";

export const metadata: Metadata = {
  title: "Store Login · FitZo",
  description: "Sign in to the FitZo store manager panel.",
};

export default function StoreLoginPage() {
  return <StoreLoginPanel />;
}
