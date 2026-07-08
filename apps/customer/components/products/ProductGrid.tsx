import type { FrontendProduct } from "@/lib/supabase/products";
import { ProductCard } from "@/components/products/ProductCard";

export function ProductGrid({ products }: { products: FrontendProduct[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
