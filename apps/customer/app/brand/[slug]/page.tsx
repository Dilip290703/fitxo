import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { createClient } from "@fitzo/supabase/server";
import { queryProducts } from "@/lib/supabase/products";
import { ProductCard } from "@/components/products/ProductCard";

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch brand + products in parallel
  const [brandRes, { products }] = await Promise.all([
    supabase
      .from("brands")
      .select("id, name, slug, logo_url, description")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle(),
    queryProducts(supabase, { brandSlug: slug, perPage: 24, sortBy: "new-arrivals" }),
  ]);

  if (!brandRes.data) notFound();
  const brand = brandRes.data;

  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />

      {/* Brand header */}
      <section className="mx-auto w-full max-w-[1100px] px-5 py-12 sm:px-6">
        <Link
          href="/brands"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#8b7058] hover:text-[#1f2a3c]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All brands
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-5">
          {brand.logo_url && (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px] border border-[#eadfd4] bg-white p-2 shadow-[0_8px_20px_rgba(34,28,20,0.06)]">
              <Image
                src={brand.logo_url}
                alt={`${brand.name} logo`}
                fill
                className="object-contain"
                sizes="64px"
              />
            </div>
          )}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
              Brand spotlight
            </p>
            <h1 className="mt-1 font-display text-[36px] leading-none tracking-[-0.03em] text-[#171717] sm:text-[44px]">
              {brand.name}
            </h1>
          </div>
        </div>

        {brand.description && (
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#6b6258]">
            {brand.description}
          </p>
        )}
      </section>

      {/* Products */}
      <section className="mx-auto w-full max-w-[1100px] px-5 pb-16 sm:px-6">
        {products.length > 0 ? (
          <>
            <p className="mb-6 text-[13px] text-[#8b7058]">
              {products.length} style{products.length !== 1 ? "s" : ""} available for try-at-home
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-[22px] border border-[#eadfd4] bg-white p-12 text-center shadow-[0_14px_34px_rgba(34,28,20,0.05)]">
            <p className="text-[15px] font-semibold text-[#1f2a3c]">
              No products from {brand.name} yet
            </p>
            <p className="mt-2 text-[14px] text-[#6b6258]">
              Check back soon — new styles drop regularly.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#1f2a3c] px-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-white transition hover:-translate-y-0.5"
            >
              Browse all products
            </Link>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
