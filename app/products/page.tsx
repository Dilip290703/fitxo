import { ProductGrid } from "@/components/ProductGrid";
import { RoutePlaceholder } from "@/components/RoutePlaceholder";
import { products } from "@/lib/mockData";

type ProductsPageProps = {
  searchParams: Promise<{
    sale?: string;
    collection?: string;
    category?: string;
    liked?: string;
  }>;
};

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;

  const filteredProducts = products.filter((product) => {
    if (params.sale === "true" && !product.sale) return false;
    if (params.collection && product.collection !== params.collection) return false;
    if (params.category && product.category !== params.category) return false;
    return true;
  });

  const pageTitle = params.sale === "true"
    ? "Sale-ready looks nearby."
    : params.collection === "summer"
      ? "Summer picks ready to try at home."
      : "Browse FitZo products.";

  return (
    <RoutePlaceholder
      eyebrow="Fitzo catalog"
      title={pageTitle}
      description="Every piece here is ready for doorstep fitting, quick delivery, and pay-later checkout."
      primaryLabel="Back to home"
      primaryHref="/"
      secondaryLabel="See all brands"
      secondaryHref="/brands"
    >
      <ProductGrid
        products={filteredProducts.length ? filteredProducts : products}
        className="bg-transparent py-0"
      />
    </RoutePlaceholder>
  );
}
