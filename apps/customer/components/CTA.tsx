import Link from "next/link";

export function CTA() {
  return (
    <section className="bg-[#f3efe7] py-16">
      <div className="section-frame">
        <div className="grid gap-8 rounded-[28px] border border-[#ebe3d8] bg-[linear-gradient(135deg,#fffdf8_0%,#f8f0e5_60%,#f6c29f_100%)] px-6 py-8 shadow-[0_25px_50px_rgba(33,29,26,0.08)] md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-10">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.26em] text-[#8a6a53]">
              Booked to your door
            </p>
            <h2 className="mt-4 font-display text-[38px] leading-[0.95] font-medium tracking-[-0.04em] text-black sm:text-[52px]">
              Your next outfit is already nearby.
            </h2>
            <p className="mt-4 max-w-[520px] text-[14px] leading-7 text-[#6f6050]">
              Start with live recommendations, try on at your door while the
              rider waits, and only pay for the pieces you keep. No guesswork.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-4 md:items-end">
            <Link
              href="/products"
              className="button-shadow inline-flex h-12 items-center justify-center rounded-[999px] bg-[color:var(--accent)] px-7 text-[11px] font-extrabold uppercase tracking-[0.26em] text-black transition duration-300 hover:-translate-y-0.5 hover:brightness-95"
            >
              Book your try-on
            </Link>
            <Link
              href="/products?collection=summer"
              className="inline-flex h-12 items-center justify-center rounded-[999px] border border-[#cab6a5] px-7 text-[11px] font-extrabold uppercase tracking-[0.26em] text-[#4b3b2e] transition duration-300 hover:bg-white/70"
            >
              Browse collections
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
