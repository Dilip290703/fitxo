import type { Metadata } from "next";
import { StaffView } from "@/components/staff/StaffView";

export const metadata: Metadata = { title: "Staff · FitZo Store" };

export default function StaffPage() {
  return <StaffView />;
}
