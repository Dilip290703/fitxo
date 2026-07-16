'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/admin/Toast';
import { updateSettings, type SystemSettings } from './actions';

const inputClass = 'w-full bg-white border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink transition-colors';
const labelClass = 'block text-xs font-medium text-soft mb-1.5';
const buttonClass = 'px-4 py-2 text-sm bg-ink hover:bg-ink-soft disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg';

// Render minutes as a friendly equivalent, e.g. 1440 → "= 24h", 7 → "= 7 min".
function humanizeMinutes(min: number): string {
  if (!Number.isFinite(min) || min < 1) return '';
  if (min % 60 === 0) return `= ${min / 60}h`;
  if (min > 60) return `= ${Math.floor(min / 60)}h ${min % 60}m`;
  return `= ${min} min`;
}

export default function SettingsClient({ initial }: { initial: SystemSettings }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [general, setGeneral] = useState({
    site_name: initial.site_name,
    contact_email: initial.contact_email,
    support_phone: initial.support_phone,
  });

  const [delivery, setDelivery] = useState({
    try_window_minutes: String(initial.try_window_minutes),
    delivery_fee: String(initial.delivery_fee),
    free_delivery_above: String(initial.free_delivery_above),
    offer_expiry_minutes: String(initial.offer_expiry_minutes),
    first_order_free: Boolean(initial.first_order_free),
  });

  const [commission, setCommission] = useState({
    commission_rate: String(initial.commission_rate),
    rider_fee: String(initial.rider_fee),
  });

  function save(label: string, patch: Partial<SystemSettings>) {
    startTransition(async () => {
      try {
        await updateSettings(patch);
        toast(`${label} saved!`, 'success');
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not save settings', 'error');
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-ink">Settings</h2>

      {/* General */}
      <section className="bg-white border border-line rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-ink">General</h3>
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
        <button onClick={() => save('General settings', general)} disabled={isPending} className={buttonClass}>
          {isPending ? 'Saving…' : 'Save General Settings'}
        </button>
      </section>

      {/* Delivery & Try-On */}
      <section className="bg-white border border-line rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-ink">Delivery & Try-On</h3>
        <div>
          <label className={labelClass}>
            Try Window (minutes) <span className="text-muted">{humanizeMinutes(Number(delivery.try_window_minutes))}</span>
          </label>
          <p className="text-xs text-muted mb-1.5">How long customers have to try items before deciding</p>
          <input type="number" value={delivery.try_window_minutes} min={1} onChange={(e) => setDelivery((f) => ({ ...f, try_window_minutes: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Default Delivery Fee (₹)</label>
          <input type="number" value={delivery.delivery_fee} min={0} onChange={(e) => setDelivery((f) => ({ ...f, delivery_fee: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Free Delivery Above (₹, KEPT value)</label>
          <p className="text-xs text-muted mb-1.5">
            Since migration 050 this is judged on what the customer KEEPS, not what they order —
            the upfront fee is auto-refunded when kept value crosses it. 0 disables the waiver.
          </p>
          <input type="number" value={delivery.free_delivery_above} min={0} onChange={(e) => setDelivery((f) => ({ ...f, free_delivery_above: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-body cursor-pointer">
            <input
              type="checkbox"
              checked={delivery.first_order_free}
              onChange={(e) => setDelivery((f) => ({ ...f, first_order_free: e.target.checked }))}
              className="accent-ink"
            />
            First order ships free
          </label>
          <p className="text-xs text-muted mt-1">
            Acquisition lever (050): a customer&apos;s first non-cancelled order carries no delivery fee.
          </p>
        </div>
        <div>
          <label className={labelClass}>
            Offer Expiry (minutes) <span className="text-muted">{humanizeMinutes(Number(delivery.offer_expiry_minutes))}</span>
          </label>
          <p className="text-xs text-muted mb-1.5">How long a confirmed order keeps ringing riders before it&apos;s cancelled as unfulfillable</p>
          <input type="number" value={delivery.offer_expiry_minutes} min={5} onChange={(e) => setDelivery((f) => ({ ...f, offer_expiry_minutes: e.target.value }))} className={inputClass} />
        </div>
        <button
          onClick={() =>
            save('Delivery settings', {
              try_window_minutes: Number(delivery.try_window_minutes),
              delivery_fee: Number(delivery.delivery_fee),
              free_delivery_above: Number(delivery.free_delivery_above),
              offer_expiry_minutes: Number(delivery.offer_expiry_minutes),
              first_order_free: delivery.first_order_free,
            })
          }
          disabled={isPending}
          className={buttonClass}
        >
          {isPending ? 'Saving…' : 'Save Delivery Settings'}
        </button>
      </section>

      {/* Commission */}
      <section className="bg-white border border-line rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-ink">Commission & Payouts</h3>
        <div>
          <label className={labelClass}>Platform Commission (%)</label>
          <p className="text-xs text-muted mb-1.5">Fitzo&apos;s cut of each kept item; the rest is the store payout</p>
          <input type="number" value={commission.commission_rate} min={0} max={100} step={0.5} onChange={(e) => setCommission((f) => ({ ...f, commission_rate: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Rider Pay per Delivery (₹)</label>
          <p className="text-xs text-muted mb-1.5">What a rider earns for each completed delivery — a platform cost, paid regardless of the customer&apos;s delivery charge</p>
          <input type="number" value={commission.rider_fee} min={0} onChange={(e) => setCommission((f) => ({ ...f, rider_fee: e.target.value }))} className={inputClass} />
        </div>
        <button onClick={() => save('Commission settings', { commission_rate: Number(commission.commission_rate), rider_fee: Number(commission.rider_fee) })} disabled={isPending} className={buttonClass}>
          {isPending ? 'Saving…' : 'Save Commission Settings'}
        </button>
      </section>

      {/* Environment Variables Notice */}
      <section className="bg-white border border-line rounded-xl p-6">
        <h3 className="text-sm font-semibold text-ink mb-3">Environment Setup</h3>
        <p className="text-xs text-soft mb-3">Add these to your <code className="text-info">.env.local</code> file:</p>
        <pre className="bg-white rounded-lg p-4 text-xs text-body font-mono overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`}
        </pre>
      </section>
    </div>
  );
}
