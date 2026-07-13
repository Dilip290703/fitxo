import type { FrontendProduct } from "@/lib/supabase/products";
import { ProductCard } from "@/components/products/ProductCard";
import { StaggerGroup, StaggerItem } from "@/components/motion";

export function ProductGrid({ products }: { products: FrontendProduct[] }) {
  return (
    <StaggerGroup
      amount={0.05}
      stagger={0.05}
      className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4"
    >
      {products.map((product) => (
        <StaggerItem key={product.id}>
          <ProductCard product={product} />
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
