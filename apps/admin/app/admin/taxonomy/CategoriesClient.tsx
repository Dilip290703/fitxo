'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import { logActivity } from '@/lib/activity';
import type { Category } from '@fitzo/supabase/types';

interface Props {
  categories: Category[];
  tree: Category[];
}

function CategoryNode({ cat, depth = 0 }: { cat: Category; depth?: number }) {
  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-hairline/40 group"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {depth > 0 && <span className="text-faint text-xs">└</span>}
        <span className="text-sm text-body">{cat.name}</span>
        <span className="text-xs text-faint capitalize">{cat.gender}</span>
        {!cat.is_active && <span className="text-xs text-faint italic">inactive</span>}
      </div>
      {cat.children?.map((child) => (
        <CategoryNode key={child.id} cat={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function CategoriesClient({ categories, tree }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', slug: '', parent_id: '',
    gender: 'unisex' as Category['gender'],
    sort_order: '0',
  });

  const handleCreate = async () => {
    setSaving(true);
    const { error } = await supabase.from('categories').insert({
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
      parent_id: form.parent_id || null,
      gender: form.gender,
      sort_order: parseInt(form.sort_order) || 0,
    });
    setSaving(false);
    if (error) toast(error.message, 'error');
    else {
      await logActivity(supabase, { action: 'Created category', entity_type: 'category', new_value: { name: form.name, gender: form.gender } });
      toast('Category created!', 'success'); setShowForm(false); setForm({ name: '', slug: '', parent_id: '', gender: 'unisex', sort_order: '0' }); router.refresh();
    }
  };

  const inputClass = 'w-full bg-sand border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-ink';

  // Flatten categories for parent select (only top-level or depth=1)
  const parentOptions = categories.filter((c) => !c.parent_id);

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm bg-ink hover:bg-ink-soft text-white font-medium rounded-lg">
        {showForm ? '× Cancel' : '+ Add Category'}
      </button>

      {showForm && (
        <div className="bg-white border border-line rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-ink">New Category</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-soft mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-soft mb-1">Slug</label>
              <input type="text" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-soft mb-1">Parent Category</label>
              <select value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))} className={inputClass}>
                <option value="">None (top-level)</option>
                {parentOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-soft mb-1">Gender</label>
              <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Category['gender'] }))} className={inputClass}>
                <option value="unisex">Unisex</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="kids">Kids</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-soft mb-1">Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving || !form.name} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-medium rounded-lg">
            {saving ? 'Creating…' : 'Create Category'}
          </button>
        </div>
      )}

      {/* Tree View */}
      <div className="bg-white border border-line rounded-xl p-4">
        <h3 className="text-xs font-semibold text-soft uppercase tracking-wide mb-3">Category Tree</h3>
        {tree.length === 0 ? (
          <p className="text-sm text-muted">No categories yet</p>
        ) : (
          tree.map((cat) => <CategoryNode key={cat.id} cat={cat} />)
        )}
      </div>
    </div>
  );
}
