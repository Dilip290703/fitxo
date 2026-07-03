'use client';

import { useState } from 'react';
import type { Category } from '@fitzo/supabase/types';
import BrandsClient from './BrandsClient';
import CategoriesClient from './CategoriesClient';

type BrandsProps = React.ComponentProps<typeof BrandsClient>;

export default function TaxonomyTabs({
  brands,
  categories,
  tree,
}: {
  brands: BrandsProps['brands'];
  categories: Category[];
  tree: Category[];
}) {
  const [tab, setTab] = useState<'brands' | 'categories'>('brands');

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {(
          [
            { value: 'brands', label: `Brands (${brands.length})` },
            { value: 'categories', label: `Categories (${categories.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t.value ? 'bg-ink text-white' : 'text-soft hover:text-ink hover:bg-cream'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'brands' ? <BrandsClient brands={brands} /> : <CategoriesClient categories={categories} tree={tree} />}
    </div>
  );
}
