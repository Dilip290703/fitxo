import { createClient } from '@fitzo/supabase/server';
import Link from 'next/link';
import InventoryClient from './InventoryClient';

export default async function InventoryPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: stores }, { data: brands }, { data: categories }] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id, name, slug, base_price, discounted_price, is_active, is_featured, created_at,
        stores(id, name),
        brands(id, name),
        categories(id, name),
        product_colors(id),
        product_variants(id, stock_qty, available_qty)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
    supabase.from('stores').select('id, name').eq('is_active', true),
    supabase.from('brands').select('id, name').eq('is_active', true),
    supabase.from('categories').select('id, name').eq('is_active', true),
  ]);

  // Supabase returns joined relations - cast to expected shape
  type ProductRow = {
    id: string; name: string; slug: string; base_price: number; discounted_price: number | null;
    is_active: boolean; is_featured: boolean; created_at: string;
    stores: { id: string; name: string } | null;
    brands: { id: string; name: string } | null;
    categories: { id: string; name: string } | null;
    product_colors: { id: string }[];
    product_variants: { id: string; stock_qty: number; available_qty: number }[];
  };

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Inventory</h2>
          <p className="text-sm text-gray-500">{products?.length ?? 0} products</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/inventory/bulk-upload"
            className="px-4 py-2 text-sm border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 rounded-lg transition-colors"
          >
            Bulk Upload
          </Link>
          <Link
            href="/admin/inventory/new"
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
          >
            + Add Product
          </Link>
        </div>
      </div>

      <InventoryClient
        products={(products ?? []) as unknown as ProductRow[]}
        stores={stores ?? []}
        brands={brands ?? []}
        categories={categories ?? []}
      />
    </div>
  );
}
