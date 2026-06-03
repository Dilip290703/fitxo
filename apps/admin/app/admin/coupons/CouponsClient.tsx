'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import StatusBadge from '@/components/admin/StatusBadge';
import type { Coupon } from '@fitzo/supabase/types';

export default function CouponsClient({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '', description: '',
    discount_type: 'percent' as 'percent' | 'flat',
    discount_value: '', min_order_amount: '0',
    max_discount_amount: '', usage_limit: '',
    valid_from: new Date().toISOString().slice(0, 16),
    valid_until: '',
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    setSaving(true);
    const { error } = await supabase.from('coupons').insert({
      code: form.code.toUpperCase(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value) || 0,
      min_order_amount: parseFloat(form.min_order_amount) || 0,
      max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
      valid_from: form.valid_from,
      valid_until: form.valid_until || null,
      is_active: true,
    });
    setSaving(false);
    if (error) toast(error.message, 'error');
    else { toast('Coupon created!', 'success'); setShowForm(false); router.refresh(); }
  };

  const toggleActive = async (coupon: Coupon) => {
    const { error } = await supabase.from('coupons').update({ is_active: !coupon.is_active }).eq('id', coupon.id);
    if (error) toast(error.message, 'error');
    else { toast(`Coupon ${!coupon.is_active ? 'activated' : 'deactivated'}`, 'success'); router.refresh(); }
  };

  const inputClass = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500';

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg">
        {showForm ? '× Cancel' : '+ Create Coupon'}
      </button>

      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">New Coupon</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Code *</label>
              <input type="text" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} className={inputClass} placeholder="SUMMER20" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Discount Type</label>
              <select value={form.discount_type} onChange={(e) => set('discount_type', e.target.value)} className={inputClass}>
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Discount Value *</label>
              <input type="number" value={form.discount_value} onChange={(e) => set('discount_value', e.target.value)} className={inputClass} placeholder={form.discount_type === 'percent' ? '20' : '100'} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Min Order (₹)</label>
              <input type="number" value={form.min_order_amount} onChange={(e) => set('min_order_amount', e.target.value)} className={inputClass} />
            </div>
            {form.discount_type === 'percent' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Max Discount (₹)</label>
                <input type="number" value={form.max_discount_amount} onChange={(e) => set('max_discount_amount', e.target.value)} className={inputClass} placeholder="Optional cap" />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Usage Limit</label>
              <input type="number" value={form.usage_limit} onChange={(e) => set('usage_limit', e.target.value)} className={inputClass} placeholder="Unlimited" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Valid From</label>
              <input type="datetime-local" value={form.valid_from} onChange={(e) => set('valid_from', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Valid Until</label>
              <input type="datetime-local" value={form.valid_until} onChange={(e) => set('valid_until', e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <input type="text" value={form.description} onChange={(e) => set('description', e.target.value)} className={inputClass} />
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving || !form.code || !form.discount_value} className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-medium rounded-lg">
            {saving ? 'Creating…' : 'Create Coupon'}
          </button>
        </div>
      )}

      {/* List */}
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/50">
              {['Code', 'Type', 'Value', 'Min Order', 'Usage', 'Validity', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-mono text-indigo-400 font-medium">{c.code}</td>
                <td className="px-4 py-3 text-gray-300 capitalize">{c.discount_type}</td>
                <td className="px-4 py-3 text-white font-medium">
                  {c.discount_type === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`}
                  {c.max_discount_amount && <span className="text-gray-500 text-xs ml-1">(max ₹{c.max_discount_amount})</span>}
                </td>
                <td className="px-4 py-3 text-gray-300">₹{c.min_order_amount}</td>
                <td className="px-4 py-3 text-gray-300">
                  {c.used_count}{c.usage_limit ? `/${c.usage_limit}` : ''}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {c.valid_until ? new Date(c.valid_until).toLocaleDateString('en-IN') : 'No expiry'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.is_active ? 'active' : 'inactive'} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(c)} className="text-xs text-indigo-400 hover:text-indigo-300">
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No coupons yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
