"use client";

import { useEffect } from "react";

import { CTA } from "@/components/CTA";
import { FeaturedStores } from "@/components/FeaturedStores";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { Testimonials } from "@/components/Testimonials";
import { TrustStrip } from "@/components/TrustStrip";

import { testFirebaseConnection } from "../src/firebase/testFirebase";

export default function HomePage() {

  useEffect(() => {
    testFirebaseConnection();
  }, []);

  return (
    <main className="page-shell min-h-screen">
      <Navbar />
      <Hero />
      <TrustStrip />
      <FeaturedStores />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
}