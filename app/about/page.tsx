import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { AboutCTA } from "@/components/about/CTA";
import { AboutHero } from "@/components/about/AboutHero";
import { Features } from "@/components/about/Features";
import { HowItWorks } from "@/components/about/HowItWorks";
import { Mission } from "@/components/about/Mission";
import { StorySection } from "@/components/about/StorySection";

const proofItems = [
  {
    rating: "4.9/5",
    label: "Early user rating",
    text: "Fast fittings, easier decisions, and zero pressure at checkout.",
  },
  {
    rating: "60 min",
    label: "Average delivery time",
    text: "Built for last-minute plans and same-day wardrobe moments.",
  },
  {
    rating: "Pay later",
    label: "Confidence-first checkout",
    text: "Keep only what feels right and return the rest at the doorstep.",
  },
];

export default function AboutPage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar />
      <AboutHero />
      <StorySection />
      <Features />
      <HowItWorks />

      <section className="bg-[#fcfbf8] py-20">
        <div className="section-frame">
          <div className="mx-auto max-w-[620px] text-center fade-up">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8a7d71]">
              Loved by early users
            </p>
            <h2 className="mt-4 font-display text-[38px] leading-[0.98] font-medium tracking-[-0.04em] text-[#181818] sm:text-[52px]">
              Trust built one doorstep try-on at a time.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {proofItems.map((item, index) => (
              <article
                key={item.label}
                className={`fade-up rounded-[22px] border border-[#ece3d9] bg-white px-7 py-8 shadow-[0_18px_40px_rgba(30,24,19,0.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(30,24,19,0.1)] ${
                  index === 1 ? "fade-delay-1" : index === 2 ? "fade-delay-2" : ""
                }`}
              >
                <p className="font-display text-[38px] leading-none font-medium tracking-[-0.04em] text-[#171717]">
                  {item.rating}
                </p>
                <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#8a7d71]">
                  {item.label}
                </p>
                <p className="mt-4 text-[14px] leading-7 text-[#5e5852]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Mission />
      <AboutCTA />
      <Footer />
    </main>
  );
}
