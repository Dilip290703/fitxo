import Link from "next/link";

export function CTA() {
  return (
    <section className="bg-[#f4f1ea] py-16">
      <div className="section-frame">
        <div className="grid gap-8 rounded-[24px] border border-[#e6dac8] bg-white px-6 py-10 shadow-[0_24px_48px_-28px_rgba(34,27,19,0.25)] md:grid-cols-[1.2fr_0.8fr] md:px-12 md:py-12">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#a48d78]">
              Booked to your door
            </p>
            <h2 className="mt-4 font-display text-[38px] leading-[1.02] font-medium tracking-[-0.02em] text-[#221b13] sm:text-[52px]">
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
              className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full border border-[#221b13] bg-[#221b13] px-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#faf9f6] transition-colors duration-500 hover:text-[#221b13]"
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 -translate-x-full rounded-full bg-white transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"
              />
              <span className="relative z-10">Book your try-on</span>
            </Link>
            <Link
              href="/products?sale=true"
              className="inline-flex h-12 items-center justify-center rounded-full border border-[#cbb9a4] px-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f6050] transition duration-300 hover:border-[#221b13] hover:text-[#221b13]"
            >
              Shop the sale
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
