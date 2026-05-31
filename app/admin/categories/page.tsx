import { createClient } from '@/lib/supabase/server';
import CategoriesClient from './CategoriesClient';
import type { Category } from '@/lib/supabase/types';

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

export default async function CategoriesPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
    .order('name');

  const tree = buildTree((categories ?? []) as Category[]);

  return (
    <div className="space-y-4 max-w-4xl">
      <h2 className="text-xl font-bold text-white">Categories</h2>
      <CategoriesClient categories={categories ?? []} tree={tree} />
    </div>
  );
}
