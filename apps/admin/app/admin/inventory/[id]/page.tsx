import { createClient } from '@fitzo/supabase/server';
import { notFound } from 'next/navigation';
import ProductFormClient from '../ProductFormClient';
import Link from 'next/link';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: stores }, { data: brands }, { data: categories }] = await Promise.all([
    supabase
      .from('products')
      .select(`
        *, stores(id, name), brands(id, name), categories(id, name),
        product_colors(*, product_variants(*)),
        product_images(*)
      `)
      .eq('id', id)
      .eq('is_deleted', false)
      .single(),
    supabase.from('stores').select('id, name').eq('is_active', true),
    supabase.from('brands').select('id, name').eq('is_active', true),
    supabase.from('categories').select('id, name, parent_id').eq('is_active', true),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/inventory" className="text-sm text-muted hover:text-ink">← Inventory</Link>
        <span className="text-faint">/</span>
        <h2 className="text-xl font-bold text-ink">{product.name}</h2>
      </div>

      {/* Variant stock table */}
      {product.product_colors && product.product_colors.length > 0 && (
        <div className="bg-white border border-line rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-ink mb-3">Variant Stock</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-soft">
                  <th className="text-left pb-2">Color</th>
                  <th className="text-left pb-2">Size</th>
                  <th className="text-left pb-2">SKU</th>
                  <th className="text-right pb-2">Stock</th>
                  <th className="text-right pb-2">Reserved</th>
                  <th className="text-right pb-2">Available</th>
                </tr>
              </thead>
              <tbody>
                {product.product_colors.flatMap((color: {
                  color_name: string;
                  color_hex: string | null;
                  product_variants: {
                    id: string;
                    size: string;
                    sku: string;
                    stock_qty: number;
                    reserved_qty: number;
                    available_qty: number;
                  }[];
                }) =>
                  color.product_variants.map((v) => (
                    <tr key={v.id} className="border-b border-hairline">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color.color_hex ?? '#888' }} />
                          {color.color_name}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-body">{v.size}</td>
                      <td className="py-2 pr-3 font-mono text-soft">{v.sku}</td>
                      <td className="py-2 text-right text-body">{v.stock_qty}</td>
                      <td className="py-2 text-right text-warn">{v.reserved_qty}</td>
                      <td className={`py-2 text-right font-medium ${v.available_qty === 0 ? 'text-danger' : 'text-success'}`}>
                        {v.available_qty}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProductFormClient
        stores={stores ?? []}
        brands={brands ?? []}
        categories={categories ?? []}
        mode="edit"
        product={product}
      />
    </div>
  );
}
