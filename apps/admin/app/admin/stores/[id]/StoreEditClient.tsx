'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import { logActivity } from '@/lib/activity';
import type { Store } from '@fitzo/supabase/types';

export default function StoreEditClient({ store }: { store: Store }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: store.name,
    description: store.description ?? '',
    contact_email: store.contact_email ?? '',
    contact_phone: store.contact_phone ?? '',
    city: store.city ?? '',
    pincode: store.pincode ?? '',
    is_active: store.is_active,
    is_verified: store.is_verified,
  });

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const inputClass = 'w-full bg-sand border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink transition-colors';

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('stores').update(form).eq('id', store.id);
    setSaving(false);
    if (error) toast(error.message, 'error');
    else {
      await logActivity(supabase, { action: 'Updated store', entity_type: 'store', entity_id: store.id, new_value: { ...form } });
      toast('Store updated!', 'success'); router.refresh();
    }
  };

  return (
    <div className="bg-white border border-line rounded-xl p-5 space-y-3">
      <h3 className="text-xs font-semibold text-soft uppercase tracking-wide">Store Info</h3>

      <div>
        <label className="block text-xs text-soft mb-1">Name</label>
        <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-soft mb-1">City</label>
        <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-soft mb-1">Pincode</label>
        <input type="text" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-soft mb-1">Contact Email</label>
        <input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="block text-xs text-soft mb-1">Phone</label>
        <input type="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} className={inputClass} />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-body cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="accent-ink" />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm text-body cursor-pointer">
          <input type="checkbox" checked={form.is_verified} onChange={(e) => set('is_verified', e.target.checked)} className="accent-green-600" />
          Verified
        </label>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2 text-sm bg-ink hover:bg-ink-soft disabled:opacity-60 text-white font-medium rounded-lg"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
