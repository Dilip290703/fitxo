import { createClient } from "@fitxo/supabase/client";

export type CatalogueProduct = {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  discountedPrice: number | null;
  isActive: boolean;
  createdAt: string;
  categoryName: string | null;
  variantCount: number;
  totalStock: number;
};

/**
 * Load every product for one store, including inactive/draft ones (migration
 * 004's manager-read policy makes these visible). Soft-deleted products are
 * excluded. Aggregates variant count + total stock per product.
 */
export async function loadStoreProducts(storeId: string): Promise<CatalogueProduct[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, base_price, discounted_price, is_active, created_at, categories(name), product_variants(id, stock_qty)",
    )
    .eq("store_id", storeId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((p: any) => {
    const category = Array.isArray(p.categories) ? p.categories[0] : p.categories;
    const variants: { stock_qty: number }[] = p.product_variants ?? [];
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: Number(p.base_price ?? 0),
      discountedPrice: p.discounted_price == null ? null : Number(p.discounted_price),
      isActive: p.is_active,
      createdAt: p.created_at,
      categoryName: category?.name ?? null,
      variantCount: variants.length,
      totalStock: variants.reduce((sum, v) => sum + Number(v.stock_qty ?? 0), 0),
    };
  });
}

/** Toggle a product live/inactive. Allowed by the products_manager_write policy. */
export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

/** Soft-delete a product (reversible in DB); also removes it from the live store. */
export async function softDeleteProduct(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_deleted: true, is_active: false })
    .eq("id", id);
  if (error) throw error;
}
