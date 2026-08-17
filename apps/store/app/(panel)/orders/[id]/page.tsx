import type { Metadata } from "next";
import { OrderDetailView } from "@/components/orders/OrderDetailView";

export const metadata: Metadata = { title: "Order · FitXo Store" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailView orderId={id} />;
}
