'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/admin/Toast';
import ImageUploader from '@/components/admin/ImageUploader';

export default function NewStorePage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');

  const [form, setForm] = useState({
    name: '', slug: '', description: '',
    contact_email: '', contact_phone: '',
    address: '', city: '', pincode: '',
    lat: '', lng: '',
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('stores').insert({
      name: form.name,
      slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
      description: form.description || null,
      logo_url: logoUrl || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      address: form.address || null,
      city: form.city || null,
      pincode: form.pincode || null,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
    });
    setSaving(false);
    if (error) toast(error.message, 'error');
    else { toast('Store created!', 'success'); router.push('/admin/stores'); router.refresh(); }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-6">Add New Store</h2>
      <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Store Name *</label>
            <input required type="text" value={form.name} onChange={(e) => { set('name', e.target.value); set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-')); }} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Slug</label>
            <input type="text" value={form.slug} onChange={(e) => set('slug', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Logo</label>
            <ImageUploader bucket="store-logos" onUpload={setLogoUrl} />
            {logoUrl && <p className="text-xs text-green-400 mt-1">Uploaded ✓</p>}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Contact Email</label>
            <input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Contact Phone</label>
            <input type="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Address</label>
            <input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">City</label>
            <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Pincode</label>
            <input type="text" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Latitude</label>
            <input type="number" step="any" value={form.lat} onChange={(e) => set('lat', e.target.value)} className={inputClass} placeholder="18.5204" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Longitude</label>
            <input type="number" step="any" value={form.lng} onChange={(e) => set('lng', e.target.value)} className={inputClass} placeholder="73.8567" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-gray-500">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-6 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold rounded-lg">
            {saving ? 'Creating…' : 'Create Store'}
          </button>
        </div>
      </form>
    </div>
  );
}
