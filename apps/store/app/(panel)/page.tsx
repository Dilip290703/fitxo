import type { Metadata } from "next";
import { StoreDashboard } from "@/components/dashboard/StoreDashboard";

export const metadata: Metadata = { title: "Dashboard · FitZo Store" };

export default function StoreHome() {
  return <StoreDashboard />;
}
