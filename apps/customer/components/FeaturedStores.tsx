import { BrandCarousel } from "@/components/BrandCarousel";
import { BrandsForYou } from "@/components/BrandsForYou";
import { ExperiencePreview } from "@/components/ExperiencePreview";
import { ProductGrid } from "@/components/ProductGrid";
import { createClient } from "@fitzo/supabase/server";
import { queryFeaturedProducts, type FrontendProduct } from "@/lib/supabase/products";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80";

function toHomepageProduct(p: FrontendProduct) {
  return {
    id: p.id,
    title: p.title,
    subtitle: p.badge,
    brand: p.brand,
    brandSlug: p.brandSlug,
    category: "",
    price: p.price,
    sale: p.price < p.oldPrice,
    collection: "",
    image: p.image || FALLBACK_IMAGE,
  };
}

export async function FeaturedStores() {
  const supabase = await createClient();
  const [featuredProducts, brandsRes] = await Promise.all([
    queryFeaturedProducts(supabase, 4),
    supabase.from("brands").select("name, slug").eq("is_active", true).order("name").limit(6),
  ]);

  const brands = (brandsRes.data ?? []) as { name: string; slug: string }[];
  const products = featuredProducts.map(toHomepageProduct);

  return (
    <section id="featured-stores">
      <div className="bg-[#f8f6f3] px-10 py-20">
        <BrandCarousel />
      </div>

      <ProductGrid
        title="This week's hot picks are HOT hot"
        description="From festive edits to streetwear staples, browse the styles nearby and schedule a doorstep fitting."
        products={products}
      />

      <ExperiencePreview />
      <BrandsForYou brands={brands.length > 0 ? brands : undefined} />
    </section>
  );
}
