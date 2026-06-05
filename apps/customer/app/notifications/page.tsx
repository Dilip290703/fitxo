import { NotificationsView } from "@/components/notifications/NotificationsView";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export default function NotificationsPage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />
      <NotificationsView />
      <Footer />
    </main>
  );
}
