import { createAdminClient } from '@/lib/supabase/admin';
import ProductFormClient from '../ProductFormClient';

export default async function NewProductPage() {
  const supabase = createAdminClient();

  const [{ data: stores }, { data: brands }, { data: categories }] = await Promise.all([
    supabase.from('stores').select('id, name').eq('is_active', true),
    supabase.from('brands').select('id, name').eq('is_active', true),
    supabase.from('categories').select('id, name, parent_id').eq('is_active', true),
  ]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Add New Product</h2>
        <p className="text-sm text-gray-500 mt-0.5">Complete all steps to publish</p>
      </div>
      <ProductFormClient
        stores={stores ?? []}
        brands={brands ?? []}
        categories={categories ?? []}
        mode="create"
      />
    </div>
  );
}
