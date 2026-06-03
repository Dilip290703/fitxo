import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { RecommendedCarousel } from "@/components/product/RecommendedCarousel";
import { createClient } from "@fitzo/supabase/server";
import {
  queryProductDetail,
  queryRecommendedProducts,
} from "@/lib/supabase/products";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const product = await queryProductDetail(supabase, id);
  if (!product) notFound();

  const recommended = await queryRecommendedProducts(supabase, product.id);

  return (
    <main className="min-h-screen bg-[#fbfaf7] pb-20 sm:pb-0">
      <Navbar showSecondaryNav={false} />

      <section className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="grid items-start gap-8 lg:grid-cols-[1.12fr_0.88fr] xl:gap-12">
          <ProductGallery product={product} />
          <ProductInfo product={product} />
        </div>
      </section>

      <RecommendedCarousel products={recommended} />
      <Footer />
    </main>
  );
}
