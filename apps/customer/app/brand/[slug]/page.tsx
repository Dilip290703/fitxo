import { ProductGrid } from "@/components/ProductGrid";
import { RoutePlaceholder } from "@/components/RoutePlaceholder";
import { brandLogoLinks, brands, products } from "@/lib/mockData";

type BrandPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BrandPage({ params }: BrandPageProps) {
  const { slug } = await params;
  const brand = brands.find((item) => item.slug === slug);
  const logoBrand = brandLogoLinks.find((item) => item.slug === slug);
  const brandProducts = products.filter((item) => item.brandSlug === slug);
  const pageTitle =
    brand?.name ??
    logoBrand?.name ??
    slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  return (
    <RoutePlaceholder
      eyebrow="Brand spotlight"
      title={pageTitle}
      description="Explore the pieces currently available for doorstep try-on from this brand."
      primaryLabel="See all products"
      primaryHref="/products"
      secondaryLabel="Browse brands"
      secondaryHref="/brands"
    >
      <ProductGrid
        products={brandProducts.length ? brandProducts : products.slice(0, 4)}
        className="bg-transparent py-0"
      />
    </RoutePlaceholder>
  );
}
