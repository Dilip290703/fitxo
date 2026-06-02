'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DataTable, { Column } from '@/components/admin/DataTable';
import { useToast } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { createClient } from '@fitzo/supabase/client';

interface Product {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  discounted_price: number | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  stores: { id: string; name: string } | null;
  brands: { id: string; name: string } | null;
  categories: { id: string; name: string } | null;
  product_colors: { id: string }[];
  product_variants: { id: string; stock_qty: number; available_qty: number }[];
}

interface FilterOption { id: string; name: string; }

interface Props {
  products: Product[];
  stores: FilterOption[];
  brands: FilterOption[];
  categories: FilterOption[];
}

export default function InventoryClient({ products, stores, brands, categories }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [search, setSearch] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStore && p.stores?.id !== filterStore) return false;
      if (filterBrand && p.brands?.id !== filterBrand) return false;
      if (filterCategory && p.categories?.id !== filterCategory) return false;
      if (filterStatus === 'active' && !p.is_active) return false;
      if (filterStatus === 'inactive' && p.is_active) return false;
      if (filterStatus === 'out_of_stock') {
        const totalAvailable = p.product_variants.reduce((s, v) => s + v.available_qty, 0);
        if (totalAvailable > 0) return false;
      }
      return true;
    });
  }, [products, search, filterStore, filterBrand, filterCategory, filterStatus]);

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('products').update({ is_active: !current }).eq('id', id);
    if (error) toast('Failed to update product', 'error');
    else { toast(`Product ${!current ? 'activated' : 'deactivated'}`, 'success'); router.refresh(); }
  };

  const softDelete = async (id: string) => {
    const { error } = await supabase.from('products').update({ is_deleted: true, is_active: false }).eq('id', id);
    if (error) toast('Failed to delete product', 'error');
    else { toast('Product deleted', 'success'); router.refresh(); }
    setConfirmDelete(null);
  };

  const bulkDeactivate = async () => {
    const { error } = await supabase.from('products').update({ is_active: false }).in('id', selected);
    if (error) toast('Bulk action failed', 'error');
    else { toast(`${selected.length} products deactivated`, 'success'); setSelected([]); router.refresh(); }
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium text-white text-sm">{row.name}</p>
          <p className="text-xs text-gray-500">{row.brands?.name ?? '—'}</p>
        </div>
      ),
    },
    { key: 'stores.name', label: 'Store', render: (_, row) => <span className="text-xs">{row.stores?.name ?? '—'}</span> },
    { key: 'categories.name', label: 'Category', render: (_, row) => <span className="text-xs">{row.categories?.name ?? '—'}</span> },
    {
      key: 'base_price',
      label: 'Price',
      sortable: true,
      render: (_, row) => (
        <div className="text-xs">
          {row.discounted_price ? (
            <>
              <span className="text-white font-medium">₹{row.discounted_price}</span>
              <span className="text-gray-500 line-through ml-1">₹{row.base_price}</span>
            </>
          ) : (
            <span className="text-white">₹{row.base_price}</span>
          )}
        </div>
      ),
    },
    {
      key: 'product_variants',
      label: 'Stock',
      render: (_, row) => {
        const total = row.product_variants.reduce((s, v) => s + v.available_qty, 0);
        return (
          <span className={`text-xs font-medium ${total === 0 ? 'text-red-400' : total < 5 ? 'text-amber-400' : 'text-green-400'}`}>
            {total === 0 ? 'Out of stock' : `${total} available`}
          </span>
        );
      },
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleActive(row.id, row.is_active); }}
          className={`w-10 h-5 rounded-full transition-colors relative ${row.is_active ? 'bg-indigo-600' : 'bg-gray-600'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${row.is_active ? 'left-5' : 'left-0.5'}`} />
        </button>
      ),
    },
    {
      key: 'id',
      label: '',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => router.push(`/admin/inventory/${row.id}`)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Edit
          </button>
          <button
            onClick={() => setConfirmDelete(row.id)}
            className="text-xs text-gray-500 hover:text-red-400"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 w-60"
        />
        <select value={filterStore} onChange={(e) => setFilterStore(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300">
          <option value="">All Stores</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300">
          <option value="">All Brands</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>

        {selected.length > 0 && (
          <button onClick={bulkDeactivate} className="ml-auto px-3 py-2 text-sm bg-red-900/40 text-red-300 border border-red-700 rounded-lg hover:bg-red-900/60">
            Deactivate {selected.length} selected
          </button>
        )}
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        keyField="id"
        pageSize={25}
        emptyMessage="No products match your filters."
        onRowClick={(row) => router.push(`/admin/inventory/${row.id}`)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Product"
        message="This will soft-delete the product. It will no longer appear to customers but can be restored from the database."
        confirmLabel="Delete"
        destructive
        onConfirm={() => confirmDelete && softDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
