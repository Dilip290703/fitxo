import { ProductsCatalogPage } from "@/components/products/ProductsCatalogPage";

type ProductsPageProps = {
  searchParams: Promise<{
    sale?: string;
    collection?: string;
    category?: string;
    liked?: string;
    sort?: string;
  }>;
};

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;

  return (
    <ProductsCatalogPage
      initialCategory={params.category}
      initialCollection={params.collection}
      initialSale={params.sale === "true"}
      initialSort={params.sort}
    />
  );
}
