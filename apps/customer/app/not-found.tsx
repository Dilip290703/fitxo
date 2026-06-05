import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />

      <section className="mx-auto flex w-full max-w-[640px] flex-col items-center px-5 py-24 text-center sm:px-6">
        <p className="font-display text-[96px] font-bold leading-none tracking-tight text-[#e9e2d8]">
          404
        </p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
          Page not found
        </p>
        <h1 className="mt-4 font-display text-[32px] leading-tight tracking-[-0.03em] text-[#171717] sm:text-[38px]">
          This look doesn&apos;t exist
        </h1>
        <p className="mt-4 max-w-sm text-[15px] leading-7 text-[#6b6258]">
          The page you&apos;re looking for may have been moved or removed.
          Let&apos;s get you back to something stylish.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/products"
            className="inline-flex h-12 items-center justify-center rounded-full bg-[#1f2a3c] px-7 text-[11px] font-semibold uppercase tracking-[0.15em] text-white transition duration-200 hover:-translate-y-0.5"
          >
            Browse products
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-full border border-[#d9ccbd] px-7 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#1f2a3c] transition duration-200 hover:bg-[#f6f1e8]"
          >
            Back to home
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
