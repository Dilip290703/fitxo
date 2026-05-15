import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RoutePlaceholder } from "@/components/RoutePlaceholder";
import { products } from "@/lib/mockData";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;
  const product = products.find((item) => item.id === id);

  if (!product) {
    notFound();
  }

  return (
    <RoutePlaceholder
      eyebrow={product.brand}
      title={product.title}
      description={`${product.subtitle}. Delivered fast, tried at home, and only paid for once it feels right.`}
      primaryLabel="Browse more products"
      primaryHref="/products"
      secondaryLabel="View brand"
      secondaryHref={`/brand/${product.brandSlug}`}
    >
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative h-[520px] overflow-hidden rounded-[28px] border border-[#eadfd4] bg-white">
          <Image
            src={product.image}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
        <div className="rounded-[28px] border border-[#eadfd4] bg-white p-8 shadow-[0_20px_50px_rgba(28,23,18,0.06)]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#8a7b6d]">
            {product.category}
          </p>
          <h2 className="mt-4 font-display text-[44px] leading-none text-[#171717]">
            {product.title}
          </h2>
          <p className="mt-4 text-[16px] leading-8 text-[#5d574f]">
            Try it at home before committing. Nearby inventory, flexible returns, and same-day convenience are built in.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Price", value: `₹${product.price}` },
              { label: "Collection", value: product.collection },
              { label: "Delivery", value: "Under 60 min" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[18px] border border-[#eee4d9] bg-[#fcfaf7] px-4 py-4"
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#8a7b6d]">
                  {item.label}
                </p>
                <p className="mt-2 text-[16px] font-semibold text-[#171717]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/cart"
              className="inline-flex h-12 items-center justify-center rounded-full bg-[#1f2a3c] px-7 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white transition duration-200 hover:bg-[#141d2b]"
            >
              Add to cart
            </Link>
            <Link
              href="/products"
              className="inline-flex h-12 items-center justify-center rounded-full border border-[#cab6a5] px-7 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#4b3b2e] transition duration-300 hover:bg-white/70"
            >
              Keep browsing
            </Link>
          </div>
        </div>
      </div>
    </RoutePlaceholder>
  );
}
