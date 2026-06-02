import { ProfilePanel } from "@/components/ProfilePanel";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export default function ProfilePage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />
      <ProfilePanel />
      <Footer />
    </main>
  );
}
