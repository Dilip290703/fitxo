import type { Metadata } from "next";
import { createClient } from "@fitzo/supabase/server";
import { queryProducts, type FrontendProduct } from "@/lib/supabase/products";
import { CxScrollProgress } from "@/components/concept/CxScrollProgress";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CategoryRail, type RailItem } from "@/components/concept/CategoryRail";
import { ArchHero, type HeroSlide } from "@/components/concept/ArchHero";
import { PromoMarquee } from "@/components/concept/PromoMarquee";
import { NewArrivals } from "@/components/concept/NewArrivals";
import { BestSellers } from "@/components/concept/BestSellers";
import { FeaturedProduct } from "@/components/concept/FeaturedProduct";
import { FantasticalBand } from "@/components/concept/FantasticalBand";
import { ShoppableVideo } from "@/components/concept/ShoppableVideo";
import { Journal } from "@/components/concept/Journal";
import "./concept.css";

export const metadata: Metadata = {
  title: "FITZO — Try before you buy",
  description: "Curated fashion from stores near you. A rider brings your picks and waits while you try them on — keep only what fits.",
};

/** Short ARLUNE-style rail labels rotated over live product imagery. */
const RAIL_LABELS = ["Jeans", "Fancy Top", "T-Shirts", "Sweaters", "Jacket", "Shirts", "Shorts", "Tops", "Denim", "Knits"];

const HERO_COPY = [
  {
    eyebrow: "New Collection",
    title: "Trends & Look",
    body: "Curated staples from stores near you — booked to your door in 60 minutes.",
    cta: "Shop the edit",
    image: "/concept/hero-1.jpg",
  },
  {
    eyebrow: "Try at Home",
    title: "Fits, Delivered",
    body: "A rider brings your picks and waits while you try them on. Keep only what fits.",
    cta: "How it works",
    image: "/concept/hero-2.jpg",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { products } = await queryProducts(supabase, { perPage: 16, sortBy: "new-arrivals" });

  // Only surface real, image-bearing catalogue items on the landing page.
  // The "new-arrivals" sort floats freshly-created rows to the top, which on
  // this env includes E2E test fixtures ("E2E … Test Tee") that carry no
  // imagery — those rendered as blank grey tiles in New Arrivals/the rail.
  const list: FrontendProduct[] = (products ?? []).filter(
    (p) => Boolean(p.image) && !/\btest\b|e2e/i.test(p.title),
  );

  const railItems: RailItem[] = list
    .slice(0, 10)
    .map((p, i) => ({ label: RAIL_LABELS[i % RAIL_LABELS.length], image: p.image }));

  const heroSlides: HeroSlide[] = HERO_COPY;

  // Best Sellers: show Jay's downloaded photos on the cards (cycled) instead of
  // the live DB imagery, while keeping the catalogue name/price/badge data.
  const BEST_SELLER_IMAGES = [
    "/concept/hero-1.jpg",
    "/concept/hero-2.jpg",
    "/concept/journal-1.jpg",
    "/concept/journal-2.jpg",
    "/concept/journal-3.jpg",
    "/concept/promo.jpg",
  ];
  const bestSellers: FrontendProduct[] = list.map((p, i) => ({
    ...p,
    image: BEST_SELLER_IMAGES[i % BEST_SELLER_IMAGES.length],
  }));

  return (
    <main className="min-h-screen bg-white font-sans text-[#1a1a1a]">
      <CxScrollProgress />
      {/* Real business navbar (home/products/location/search/cart) with its
          slim MEN/WOMEN/KIDS/COLLECTIONS bar underneath — same as the rest
          of the site, so navigation is consistent on every page. */}
      <Navbar />
      <CategoryRail items={railItems} />
      <ArchHero slides={heroSlides} />
      <PromoMarquee />
      <NewArrivals products={list.slice(0, 4)} />
      <BestSellers products={bestSellers} />
      <FeaturedProduct promoImage="/concept/promo.jpg" products={list.slice(4, 6)} />
      <FantasticalBand image="/concept/band.jpg" />
      <ShoppableVideo products={list.slice(6, 10)} />
      <Journal images={["/concept/journal-1.jpg", "/concept/journal-2.jpg", "/concept/journal-3.jpg"]} />
      <Footer />
    </main>
  );
}
