'use client';

import { useState } from 'react';
import { useToast } from '@/components/admin/Toast';

const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors';
const labelClass = 'block text-xs font-medium text-gray-400 mb-1.5';

export default function SettingsPage() {
  const { toast } = useToast();

  const [general, setGeneral] = useState({
    site_name: 'Fitzo',
    contact_email: 'support@fitzo.com',
    support_phone: '+91 98765 43210',
  });

  const [delivery, setDelivery] = useState({
    try_window_hours: '24',
    delivery_fee: '49',
    free_delivery_above: '999',
  });

  const saveGeneral = () => toast('General settings saved!', 'success');
  const saveDelivery = () => toast('Delivery settings saved!', 'success');

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-white">Settings</h2>

      {/* General */}
      <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">General</h3>
        <div>
          <label className={labelClass}>Site Name</label>
          <input type="text" value={general.site_name} onChange={(e) => setGeneral((f) => ({ ...f, site_name: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Contact Email</label>
          <input type="email" value={general.contact_email} onChange={(e) => setGeneral((f) => ({ ...f, contact_email: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Support Phone</label>
          <input type="tel" value={general.support_phone} onChange={(e) => setGeneral((f) => ({ ...f, support_phone: e.target.value }))} className={inputClass} />
        </div>
        <button onClick={saveGeneral} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg">
          Save General Settings
        </button>
      </section>

      {/* Delivery */}
      <section className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Delivery & Try-On</h3>
        <div>
          <label className={labelClass}>Try Window (hours)</label>
          <p className="text-xs text-gray-500 mb-1.5">How long customers have to try items before deciding</p>
          <input type="number" value={delivery.try_window_hours} min={1} max={72} onChange={(e) => setDelivery((f) => ({ ...f, try_window_hours: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Default Delivery Fee (₹)</label>
          <input type="number" value={delivery.delivery_fee} min={0} onChange={(e) => setDelivery((f) => ({ ...f, delivery_fee: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Free Delivery Above (₹)</label>
          <input type="number" value={delivery.free_delivery_above} min={0} onChange={(e) => setDelivery((f) => ({ ...f, free_delivery_above: e.target.value }))} className={inputClass} />
        </div>
        <button onClick={saveDelivery} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg">
          Save Delivery Settings
        </button>
      </section>

      {/* Environment Variables Notice */}
      <section className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-white mb-3">Environment Setup</h3>
        <p className="text-xs text-gray-400 mb-3">Add these to your <code className="text-indigo-400">.env.local</code> file:</p>
        <pre className="bg-gray-900 rounded-lg p-4 text-xs text-gray-300 font-mono overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`}
        </pre>
      </section>
    </div>
  );
}
