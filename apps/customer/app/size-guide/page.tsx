import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SIZE_DATA, formatMeasure } from "@/lib/sizeData";

const MEASURE_TIPS = [
  { label: "Chest", text: "Measure around the fullest part of your chest, keeping the tape parallel to the ground." },
  { label: "Front Length", text: "Measure from the highest point of the shoulder straight down to the hem." },
  { label: "Shoulder", text: "Measure across the back from one shoulder seam to the other." },
  { label: "Sleeve", text: "Measure from the shoulder seam to the end of the sleeve cuff." },
];

export const metadata = {
  title: "Size Guide — FitZo",
  description: "Find your perfect fit with the FitZo size chart and measurement guide.",
};

export default function SizeGuidePage() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />

      <section className="mx-auto w-full max-w-[920px] px-5 py-12 sm:px-6 lg:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
          Fit & sizing
        </p>
        <h1 className="mt-3 font-display text-[34px] leading-none tracking-[-0.04em] text-[#171717] sm:text-[44px]">
          Size guide
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#6b6258]">
          Use the chart below to find your size. Not sure between two? With FitZo&apos;s
          doorstep try-on, you can order both and compare the fit while the rider waits before you pay.
        </p>

        {/* Size chart */}
        <div className="mt-10 overflow-hidden rounded-[22px] border border-[#eadfd4] bg-white shadow-[0_14px_34px_rgba(34,28,20,0.05)]">
          <div className="flex items-center justify-between border-b border-[#ece4da] px-6 py-4">
            <h2 className="text-[15px] font-semibold text-[#171717]">Size chart</h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9a918a]">
              cm · in
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-[#faf8f5]">
                <tr className="border-b border-[#ece4da]">
                  <th className="py-3 pl-6 pr-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a918a]">
                    Size
                  </th>
                  {["Chest", "Length", "Shoulder", "Sleeve"].map((h) => (
                    <th key={h} className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a918a]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIZE_DATA.map((row, i) => (
                  <tr key={row.size} className={`border-b border-[#f0ebe4] ${i % 2 === 0 ? "bg-white" : "bg-[#fdfcfa]"}`}>
                    <td className="py-3 pl-6 pr-3 font-semibold text-[#171717]">{row.size}</td>
                    {(["chest", "length", "shoulder", "sleeve"] as const).map((key) => (
                      <td key={key} className="px-3 py-3 text-center text-[#3b3732]">
                        {formatMeasure(row[key], "cm")}
                        <span className="text-[#a39a90]"> / {formatMeasure(row[key], "in")}&quot;</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-6 py-4 text-[12px] text-[#9a918a]">
            Measurements shown as centimeters / inches. Sizes may vary slightly between brands.
          </p>
        </div>

        {/* How to measure */}
        <h2 className="mt-12 font-display text-[26px] tracking-[-0.02em] text-[#171717]">
          How to measure
        </h2>
        <p className="mt-2 text-[14px] leading-7 text-[#6b6258]">
          Use a soft tape measure and keep it flat against your body.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {MEASURE_TIPS.map((tip) => (
            <div key={tip.label} className="rounded-[18px] border border-[#eadfd4] bg-white px-5 py-4 shadow-[0_10px_24px_rgba(34,28,20,0.04)]">
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#171717]">{tip.label}</p>
              <p className="mt-1.5 text-[13px] leading-6 text-[#6c655e]">{tip.text}</p>
            </div>
          ))}
        </div>

        {/* Pro tip */}
        <div className="mt-8 rounded-[18px] bg-[#f4ede4] px-6 py-5">
          <p className="text-[12px] font-semibold text-[#8b7058]">💡 Pro tip</p>
          <p className="mt-1.5 text-[13px] leading-6 text-[#5f5851]">
            Between sizes? Size up for a relaxed fit, down for slim. FitZo&apos;s doorstep try-on
            lets you compare multiple sizes while the rider waits before you decide.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-10">
          <Link
            href="/products"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#1f2a3c] px-7 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition duration-200 hover:-translate-y-0.5"
          >
            Start shopping
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
