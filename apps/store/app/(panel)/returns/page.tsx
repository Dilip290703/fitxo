import type { Metadata } from "next";
import { ReturnsView } from "@/components/returns/ReturnsView";

export const metadata: Metadata = { title: "Returns · FitZo Store" };

export default function ReturnsPage() {
  return <ReturnsView />;
}
