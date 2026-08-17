import type { Metadata } from "next";
import { ReturnsView } from "@/components/returns/ReturnsView";

export const metadata: Metadata = { title: "Returns · FitXo Store" };

export default function ReturnsPage() {
  return <ReturnsView />;
}
