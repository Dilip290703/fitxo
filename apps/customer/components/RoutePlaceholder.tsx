import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

type RoutePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  children?: React.ReactNode;
};

export function RoutePlaceholder({
  eyebrow,
  title,
  description,
  primaryLabel = "Browse products",
  primaryHref = "/products",
  secondaryLabel = "Back to home",
  secondaryHref = "/",
  children,
}: RoutePlaceholderProps) {
  return (
    <main className="page-shell min-h-screen">
      <Navbar />
      <section className="bg-[#f8f6f3] px-6 py-20">
        <div className="section-frame">
          <div className="max-w-3xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8a7b6d]">
              {eyebrow}
            </p>
            <h1 className="mt-5 font-display text-[46px] leading-[0.95] tracking-[-0.05em] text-[#171717] sm:text-[64px]">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-[16px] leading-8 text-[#5a554f]">
              {description}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href={primaryHref}
                className="inline-flex h-12 items-center justify-center rounded-full bg-[#1f2a3c] px-7 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#141d2b]"
              >
                {primaryLabel}
              </Link>
              <Link
                href={secondaryHref}
                className="inline-flex h-12 items-center justify-center rounded-full border border-[#d7cab9] bg-white px-7 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#1f2a3c] transition duration-200 hover:bg-[#faf4eb]"
              >
                {secondaryLabel}
              </Link>
            </div>
          </div>
          {children ? <div className="mt-12">{children}</div> : null}
        </div>
      </section>
      <Footer />
    </main>
  );
}
