import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";

type Product = {
  id: string;
  title: string;
  subtitle: string;
  brand: string;
  brandSlug: string;
  category: string;
  price: number;
  sale: boolean;
  collection: string;
  image: string;
};

type ProductGridProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  /** Renders a "view all" affordance beside the heading on desktop. */
  viewAllHref?: string;
  products: Product[];
  className?: string;
};

function ArrowGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M5 12h13m-5-6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ProductGrid({
  eyebrow,
  title,
  description,
  viewAllHref,
  products,
  className = "bg-[color:var(--beige)] py-14 sm:py-20",
}: ProductGridProps) {
  return (
    <section id="hot-picks" className={className}>
      <div className="section-frame">
        {title ? (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-[560px]">
              {eyebrow ? (
                <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a48d78]">
                  <span aria-hidden="true" className="h-px w-7 bg-[#cbb9a4]" />
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="mt-3 font-display text-[32px] font-medium leading-[1.1] tracking-[-0.02em] text-black sm:text-[44px]">
                {title}
              </h2>
              {description ? (
                <p className="mt-4 max-w-[460px] text-[14px] leading-[1.7] text-[#6f6050]">
                  {description}
                </p>
              ) : null}
            </div>

            {viewAllHref ? (
              <Link
                href={viewAllHref}
                className="group inline-flex shrink-0 items-center gap-2 self-start text-[13px] font-medium text-[#221b13] transition duration-300 hover:text-[#a48d78] sm:self-auto"
              >
                View All Products
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  <ArrowGlyph />
                </span>
              </Link>
            ) : null}
          </div>
        ) : null}

        <div
          className={`${title ? "mt-12" : ""} grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-6`}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
