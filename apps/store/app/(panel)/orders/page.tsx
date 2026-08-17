import type { Metadata } from "next";
import { OrdersView } from "@/components/orders/OrdersView";

export const metadata: Metadata = { title: "Orders · FitXo Store" };

export default function OrdersPage() {
  return <OrdersView />;
}
