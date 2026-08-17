import type { Metadata } from "next";
import { StoreLoginPanel } from "@/components/StoreLoginPanel";

export const metadata: Metadata = {
  title: "Store Login · FitXo",
  description: "Sign in to the FitXo store manager panel.",
};

export default function StoreLoginPage() {
  return <StoreLoginPanel />;
}
