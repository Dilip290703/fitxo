import { OrderHistoryView } from "@/components/orders/OrderHistoryView";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export default function OrdersPage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />
      <OrderHistoryView />
      <Footer />
    </main>
  );
}
