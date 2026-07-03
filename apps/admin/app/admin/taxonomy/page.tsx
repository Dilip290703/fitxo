import { createClient } from '@fitzo/supabase/server';
import type { Category } from '@fitzo/supabase/types';
import TaxonomyTabs from './TaxonomyTabs';

function buildTree(categories: Category[]): Category[] {
  const map = new Map<string, Category>();
  categories.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: Category[] = [];
  categories.forEach((c) => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children!.push(map.get(c.id)!);
    } else {
      roots.push(map.get(c.id)!);
    }
  });
  return roots;
}

/** Brands + Categories merged into one catalog-taxonomy screen (two tabs). */
export default async function TaxonomyPage() {
  const supabase = await createClient();

  const [{ data: brands }, { data: productCounts }, { data: categories }] = await Promise.all([
    supabase.from('brands').select('*').order('name'),
    supabase.from('products').select('brand_id').eq('is_deleted', false),
    supabase.from('categories').select('*').order('sort_order').order('name'),
  ]);

  const countsMap = (productCounts ?? []).reduce<Record<string, number>>((acc, p) => {
    if (p.brand_id) acc[p.brand_id] = (acc[p.brand_id] ?? 0) + 1;
    return acc;
  }, {});
  const brandsWithCount = (brands ?? []).map((b) => ({ ...b, product_count: countsMap[b.id] ?? 0 }));

  const tree = buildTree((categories ?? []) as Category[]);

  return (
    <div className="space-y-4 max-w-4xl">
      <h2 className="text-xl font-bold text-white">Brands &amp; Categories</h2>
      <TaxonomyTabs
        brands={brandsWithCount}
        categories={categories ?? []}
        tree={tree}
      />
    </div>
  );
}
