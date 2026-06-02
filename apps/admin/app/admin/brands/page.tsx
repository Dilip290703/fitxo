import { createClient } from '@fitzo/supabase/server';
import BrandsClient from './BrandsClient';

export default async function BrandsPage() {
  const supabase = await createClient();

  const [{ data: brands }, { data: productCounts }] = await Promise.all([
    supabase.from('brands').select('*').order('name'),
    supabase.from('products').select('brand_id').eq('is_deleted', false),
  ]);

  const countsMap = (productCounts ?? []).reduce<Record<string, number>>((acc, p) => {
    if (p.brand_id) acc[p.brand_id] = (acc[p.brand_id] ?? 0) + 1;
    return acc;
  }, {});

  const brandsWithCount = (brands ?? []).map((b) => ({ ...b, product_count: countsMap[b.id] ?? 0 }));

  return (
    <div className="space-y-4 max-w-4xl">
      <h2 className="text-xl font-bold text-white">Brands</h2>
      <BrandsClient brands={brandsWithCount} />
    </div>
  );
}
