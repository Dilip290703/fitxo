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
  title?: string;
  description?: string;
  products: Product[];
  className?: string;
};

export function ProductGrid({
  title,
  description,
  products,
  className = "bg-[color:var(--beige)] py-14 sm:py-16",
}: ProductGridProps) {
  return (
    <section id="hot-picks" className={className}>
      <div className="section-frame">
        {title ? (
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="font-display text-[36px] font-medium tracking-[-0.02em] text-black sm:text-[48px]">
              {title}
            </h2>
            {description ? (
              <p className="mt-3 text-[13px] leading-6 text-[#63605b]">
                {description}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className={`${title ? "mt-10" : ""} grid gap-5 sm:grid-cols-2 lg:grid-cols-4`}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
