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
  // Commission override (046): blank = platform default. Affects NEW keep
  // settlements only — already-settled items keep their stamped rate.
  const [commissionRate, setCommissionRate] = useState(
    store.commission_rate === null || store.commission_rate === undefined ? '' : String(store.commission_rate),
  );

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const inputClass = 'w-full bg-sand border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink transition-colors';

  const handleSave = async () => {
    const trimmed = commissionRate.trim();
    const rate = trimmed === '' ? null : Number(trimmed);
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
      toast('Commission override must be between 0 and 100 (or blank for the platform default).', 'error');
      return;
    }
    setSaving(true);
    // commission_rate sent separately so a pre-046 DB (column missing) still
    // saves the rest of the form instead of failing the whole update.
    const { error } = await supabase.from('stores').update(form).eq('id', store.id);
    let rateError: string | null = null;
    if (!error) {
      const { error: e2 } = await supabase.from('stores').update({ commission_rate: rate }).eq('id', store.id);
      if (e2) rateError = 'Commission override not saved — apply migration 046 first.';
    }
    setSaving(false);
    if (error) toast(error.message, 'error');
    else {
      await logActivity(supabase, { action: 'Updated store', entity_type: 'store', entity_id: store.id, new_value: { ...form, commission_rate: rate } });
      toast(rateError ?? 'Store updated!', rateError ? 'error' : 'success');
      router.refresh();
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
      <div>
        <label className="block text-xs text-soft mb-1">Commission override (%)</label>
        <input
          type="text"
          inputMode="decimal"
          value={commissionRate}
          onChange={(e) => setCommissionRate(e.target.value)}
          placeholder="Blank = platform default"
          className={inputClass}
        />
        <p className="mt-1 text-[11px] text-faint">
          Applies to new Keep settlements only — already-settled items keep their stamped rate (046).
        </p>
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
