import type { Metadata } from "next";
import { createClient } from "@fitzo/supabase/server";
import { queryProducts, type FrontendProduct } from "@/lib/supabase/products";
import { ConceptNav } from "@/components/concept/ConceptNav";
import { CategoryRail, type RailItem } from "@/components/concept/CategoryRail";
import { ArchHero, type HeroSlide } from "@/components/concept/ArchHero";
import { PromoMarquee } from "@/components/concept/PromoMarquee";
import { NewArrivals } from "@/components/concept/NewArrivals";
import { FeaturedProduct } from "@/components/concept/FeaturedProduct";
import { FantasticalBand } from "@/components/concept/FantasticalBand";
import { ShoppableVideo } from "@/components/concept/ShoppableVideo";
import { Journal } from "@/components/concept/Journal";
import { ConceptFooter } from "@/components/concept/ConceptFooter";
import "./concept.css";

export const metadata: Metadata = {
  title: "FITZO — Concept preview",
  description: "ARLUNE-style design reference for Fitzo. Not the live store.",
};

/** Short ARLUNE-style rail labels rotated over live product imagery. */
const RAIL_LABELS = ["Jeans", "Fancy Top", "T-Shirts", "Sweaters", "Jacket", "Shirts", "Shorts", "Tops", "Denim", "Knits"];

const HERO_COPY = [
  {
    eyebrow: "Women's Collection",
    title: "Find Your Perfect Look",
    body: "Book a slot, try on at your door while the rider waits, and keep only what fits.",
    cta: "Shop Women's",
    image: "/concept/hero-1.jpg",
  },
  {
    eyebrow: "New In",
    title: "Try It On First",
    body: "No guesswork. A rider brings your picks and waits — pay only for what you love.",
    cta: "Shop New In",
    image: "/concept/hero-2.jpg",
  },
  {
    eyebrow: "Men's Edit",
    title: "Fits, Delivered",
    body: "Neutral staples from stores near you, at your door in 60 minutes.",
    cta: "Shop Men's",
    image: "/concept/hero-3.jpg",
  },
];

export default async function ConceptPage() {
  const supabase = await createClient();
  const { products } = await queryProducts(supabase, { perPage: 16, sortBy: "new-arrivals" });

  const list: FrontendProduct[] = products ?? [];

  const railItems: RailItem[] = list
    .slice(0, 10)
    .map((p, i) => ({ label: RAIL_LABELS[i % RAIL_LABELS.length], image: p.image }));

  const heroSlides: HeroSlide[] = HERO_COPY;

  return (
    <main className="min-h-screen bg-white font-sans text-[#1a1a1a]">
      <ConceptNav featured={list.slice(0, 4)} />
      <CategoryRail items={railItems} />
      <ArchHero slides={heroSlides} />
      <PromoMarquee />
      <NewArrivals products={list.slice(0, 4)} />
      <FeaturedProduct promoImage="/concept/promo.jpg" products={list.slice(4, 6)} />
      <FantasticalBand image="/concept/band.jpg" />
      <ShoppableVideo products={list.slice(6, 10)} />
      <Journal images={["/concept/journal-1.jpg", "/concept/journal-2.jpg", "/concept/journal-3.jpg"]} />
      <ConceptFooter />
    </main>
  );
}
