import { CategoryStrip } from "@/components/CategoryStrip";
import { CTA } from "@/components/CTA";
import { FeaturedStores } from "@/components/FeaturedStores";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { Testimonials } from "@/components/Testimonials";

export default function HomePage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar />
      <Hero />
      <CategoryStrip />
      <FeaturedStores />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
}
