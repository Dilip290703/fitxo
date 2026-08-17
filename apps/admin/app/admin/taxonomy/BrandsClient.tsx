'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitxo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import ImageUploader from '@/components/admin/ImageUploader';
import { logActivity } from '@/lib/activity';

interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  product_count: number;
}

export default function BrandsClient({ brands }: { brands: Brand[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [form, setForm] = useState({ name: '', slug: '', website_url: '', description: '' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    const { error } = await supabase.from('brands').insert({
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
      website_url: form.website_url || null,
      description: form.description || null,
      logo_url: logoUrl || null,
    });
    setSaving(false);
    if (error) toast(error.message, 'error');
    else {
      await logActivity(supabase, { action: 'Created brand', entity_type: 'brand', new_value: { name: form.name } });
      toast('Brand created!', 'success'); setShowForm(false); setForm({ name: '', slug: '', website_url: '', description: '' }); setLogoUrl(''); router.refresh();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('brands').delete().eq('id', deleteId);
    if (error) { setDeleteId(null); toast(error.message, 'error'); return; }
    await logActivity(supabase, { action: 'Deleted brand', entity_type: 'brand', entity_id: deleteId });
    setDeleteId(null);
    toast('Brand deleted', 'success'); router.refresh();
  };

  const inputClass = 'w-full bg-sand border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink';

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm bg-ink hover:bg-ink-soft text-white font-medium rounded-lg">
        {showForm ? '× Cancel' : '+ Add Brand'}
      </button>

      {showForm && (
        <div className="bg-white border border-line rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-ink">New Brand</h3>
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
              <label className="block text-xs text-soft mb-1">Website URL</label>
              <input type="url" value={form.website_url} onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))} className={inputClass} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs text-soft mb-1">Logo</label>
              <ImageUploader bucket="brand-logos" onUpload={setLogoUrl} />
              {logoUrl && <p className="text-xs text-success mt-1">Uploaded ✓</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-soft mb-1">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving || !form.name} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-medium rounded-lg">
            {saving ? 'Creating…' : 'Create Brand'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {brands.map((brand) => (
          <div key={brand.id} className="bg-white border border-line rounded-xl p-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sand rounded-lg flex items-center justify-center overflow-hidden">
                {brand.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain" />
                ) : <span className="text-lg">🏷️</span>}
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{brand.name}</p>
                <p className="text-xs text-muted">{brand.product_count} products</p>
                {brand.website_url && (
                  <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-info hover:text-ink">
                    Website →
                  </a>
                )}
              </div>
            </div>
            <button onClick={() => setDeleteId(brand.id)} className="text-faint hover:text-danger text-xs transition-colors">
              ✕
            </button>
          </div>
        ))}

        {brands.length === 0 && (
          <div className="col-span-3 py-12 text-center text-muted">No brands yet</div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Brand"
        message="Products linked to this brand will lose their brand association. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
