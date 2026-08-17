import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { HowItWorks } from "@/components/HowItWorks";

const FAQS = [
  {
    q: "How long is the try-on window?",
    a: "When the rider arrives at your delivery slot, they wait 7 minutes while you try everything on. Keep what you love and hand the rest straight back to them.",
  },
  {
    q: "When am I charged?",
    a: "You only pay for the items you keep, once you've tried them on. Nothing is charged upfront for the pieces you hand back.",
  },
  {
    q: "Do I have to schedule a return?",
    a: "No — you return the items you don't want to the rider on the spot, at the door. There's no separate pickup to arrange.",
  },
  {
    q: "How does delivery work?",
    a: "You book a delivery slot at checkout, and a rider brings your picks from partner stores near you at that time, subject to availability and your delivery zone.",
  },
];

export const metadata = {
  title: "How It Works — FitXo",
  description: "Book a delivery slot, try fashion on at your door while the rider waits, and keep only what you love.",
};

export default function HowItWorksPage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />

      {/* Intro */}
      <section className="mx-auto w-full max-w-[760px] px-5 pt-12 text-center sm:px-6 lg:pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
          The FitXo way
        </p>
        <h1 className="mt-3 font-display text-[36px] leading-tight tracking-[-0.04em] text-[#171717] sm:text-[48px]">
          Try before you buy, at your doorstep
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-[#6b6258]">
          Fashion convenience built around your schedule and your fit. Order, try on
          at your door while the rider waits, and keep only what feels right.
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
              <p className="text-[15px] font-semibold text-[#221b13]">{item.q}</p>
              <p className="mt-2 text-[14px] leading-7 text-[#6b6258]">{item.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/products"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#221b13] px-7 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition duration-200 hover:-translate-y-0.5"
          >
            Browse products
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
