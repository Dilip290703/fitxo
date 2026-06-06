import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { HowItWorks } from "@/components/HowItWorks";

const FAQS = [
  {
    q: "How long is the try-at-home window?",
    a: "Once your order is delivered, a 24-hour try window begins. Keep what you love and we'll arrange a free pickup for the rest.",
  },
  {
    q: "When am I charged?",
    a: "You only pay for the items you keep, after your try window. Nothing is charged upfront for the pieces you return.",
  },
  {
    q: "Is return pickup really free?",
    a: "Yes — a FitZo delivery partner collects your returns from your doorstep at no cost.",
  },
  {
    q: "How fast is delivery?",
    a: "We aim to deliver within 60 minutes from partner stores near you, subject to availability and your delivery zone.",
  },
];

export const metadata = {
  title: "How It Works — FitZo",
  description: "Try fashion at home in 60 minutes. Keep what you love, return the rest for free.",
};

export default function HowItWorksPage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />

      {/* Intro */}
      <section className="mx-auto w-full max-w-[760px] px-5 pt-12 text-center sm:px-6 lg:pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
          The FitZo way
        </p>
        <h1 className="mt-3 font-display text-[36px] leading-tight tracking-[-0.04em] text-[#171717] sm:text-[48px]">
          Try before you buy, at your doorstep
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-[#6b6258]">
          Fashion convenience built around your schedule and your fit. Order, try at
          home, and keep only what feels right.
        </p>
      </section>

      {/* Reuse the homepage steps section */}
      <HowItWorks />

      {/* FAQ */}
      <section className="mx-auto w-full max-w-[760px] px-5 pb-16 sm:px-6">
        <h2 className="font-display text-[28px] tracking-[-0.02em] text-[#171717]">
          Frequently asked
        </h2>
        <div className="mt-6 space-y-3">
          {FAQS.map((item) => (
            <div key={item.q} className="rounded-[18px] border border-[#eadfd4] bg-white px-6 py-5 shadow-[0_10px_24px_rgba(34,28,20,0.04)]">
              <p className="text-[15px] font-semibold text-[#1f2a3c]">{item.q}</p>
              <p className="mt-2 text-[14px] leading-7 text-[#6b6258]">{item.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/products"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#1f2a3c] px-7 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition duration-200 hover:-translate-y-0.5"
          >
            Browse products
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
