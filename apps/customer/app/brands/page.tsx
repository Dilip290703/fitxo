import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { createClient } from "@fitzo/supabase/server";

type Brand = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
};

export default async function BrandsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name, slug, logo_url, description")
    .eq("is_active", true)
    .order("name");

  const brands: Brand[] = data ?? [];

  return (
    <main className="page-shell min-h-screen">
      <Navbar showSecondaryNav={false} />

      <section className="mx-auto w-full max-w-[1100px] px-5 py-12 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
          Brand directory
        </p>
        <h1 className="mt-3 font-display text-[34px] leading-none tracking-[-0.04em] text-[#171717] sm:text-[42px]">
          Every nearby brand
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#6b6258]">
          Browse the labels available for doorstep try-on, slot-based delivery, and pay-later checkout.
        </p>

        {brands.length > 0 ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/brand/${brand.slug}`}
                className="group flex items-center gap-4 rounded-[22px] border border-[#eadfd4] bg-white p-5 shadow-[0_14px_34px_rgba(34,28,20,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(28,23,18,0.08)]"
              >
                {brand.logo_url ? (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[12px] border border-[#f0e8e0] bg-white p-1.5">
                    <Image
                      src={brand.logo_url}
                      alt={`${brand.name} logo`}
                      fill
                      className="object-contain"
                      sizes="56px"
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-[#f6f1e8]">
                    <span className="text-[18px] font-bold text-[#8b7058]">
                      {brand.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#221b13] group-hover:underline group-hover:underline-offset-2">
                    {brand.name}
                  </p>
                  {brand.description && (
                    <p className="mt-0.5 truncate text-[13px] text-[#8b7058]">
                      {brand.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-[22px] border border-[#eadfd4] bg-white p-12 text-center">
            <p className="text-[15px] font-semibold text-[#221b13]">No brands available yet</p>
            <p className="mt-2 text-[14px] text-[#6b6258]">Check back soon as we onboard new partners.</p>
            <Link
              href="/products"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#221b13] px-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-white transition hover:-translate-y-0.5"
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
