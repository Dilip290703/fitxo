import type { Metadata } from "next";
import { SupportView } from "@/components/support/SupportView";

export const metadata: Metadata = { title: "Support · FitXo Store" };

export default function SupportPage() {
  return <SupportView />;
}
