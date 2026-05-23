import { LoginPanel } from "@/components/LoginPanel";
import { Navbar } from "@/components/Navbar";

export default function LoginPage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />
      <LoginPanel />
    </main>
  );
}
