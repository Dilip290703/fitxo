'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@fitxo/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';

export interface SystemSettings {
  site_name: string;
  contact_email: string;
  support_phone: string;
  try_window_minutes: number;
  delivery_fee: number;
  free_delivery_above: number;
  offer_expiry_minutes: number;
  rider_fee: number;
  commission_rate: number;
  /** G9 (migration 050): a customer's first order ships free. */
  first_order_free: boolean;
  /** G5 (migration 053): max total units in one order. 0 = no cap. */
  max_items_per_order: number;
  /** G5 (migration 053): max not-yet-completed/cancelled orders per customer. 0 = no cap. */
  max_active_orders: number;
  /** G5 (migration 053): max orders per customer per rolling 24h (cancelled excluded). 0 = no cap. */
  max_orders_per_day: number;
}

// Mirrors the migration 011 defaults — used if the singleton row is somehow missing.
const DEFAULTS: SystemSettings = {
  site_name: 'Fitxo',
  contact_email: 'support@fitxo.co.in',
  support_phone: '',
  try_window_minutes: 1440,
  delivery_fee: 49,
  free_delivery_above: 999,
  offer_expiry_minutes: 120,
  rider_fee: 40,
  commission_rate: 15,
  first_order_free: false,
  max_items_per_order: 8,
  max_active_orders: 1,
  max_orders_per_day: 0,
};

export async function getSettings(): Promise<SystemSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('system_settings')
    .select(
      'site_name, contact_email, support_phone, try_window_minutes, delivery_fee, free_delivery_above, offer_expiry_minutes, rider_fee, commission_rate',
    )
    .eq('id', 1)
    .maybeSingle();

  // 050 column probed separately so a pre-050 DB still loads the rest.
  const { data: g9 } = await supabase
    .from('system_settings')
    .select('first_order_free')
    .eq('id', 1)
    .maybeSingle();

  // 053 cap columns probed separately for the same reason.
  const { data: g5 } = await supabase
    .from('system_settings')
    .select('max_items_per_order, max_active_orders, max_orders_per_day')
    .eq('id', 1)
    .maybeSingle();

  return { ...DEFAULTS, ...(data ?? {}), ...(g9 ?? {}), ...(g5 ?? {}) } as SystemSettings;
}

function validate(patch: Partial<SystemSettings>) {
  if (patch.site_name !== undefined && patch.site_name.trim() === '') {
    throw new Error('Site name is required');
  }
  if (patch.contact_email !== undefined && !/^\S+@\S+\.\S+$/.test(patch.contact_email)) {
    throw new Error('Enter a valid contact email');
  }
  if (patch.try_window_minutes !== undefined && (!Number.isFinite(patch.try_window_minutes) || patch.try_window_minutes < 1)) {
    throw new Error('Try window must be at least 1 minute');
  }
  if (patch.delivery_fee !== undefined && (!Number.isFinite(patch.delivery_fee) || patch.delivery_fee < 0)) {
    throw new Error('Delivery fee cannot be negative');
  }
  if (patch.free_delivery_above !== undefined && (!Number.isFinite(patch.free_delivery_above) || patch.free_delivery_above < 0)) {
    throw new Error('Free-delivery threshold cannot be negative');
  }
  if (patch.offer_expiry_minutes !== undefined && (!Number.isFinite(patch.offer_expiry_minutes) || patch.offer_expiry_minutes < 5)) {
    throw new Error('Offer expiry must be at least 5 minutes');
  }
  if (patch.rider_fee !== undefined && (!Number.isFinite(patch.rider_fee) || patch.rider_fee < 0)) {
    throw new Error('Rider fee cannot be negative');
  }
  if (patch.commission_rate !== undefined && (!Number.isFinite(patch.commission_rate) || patch.commission_rate < 0 || patch.commission_rate > 100)) {
    throw new Error('Commission rate must be between 0 and 100');
  }
  for (const key of ['max_items_per_order', 'max_active_orders', 'max_orders_per_day'] as const) {
    const v = patch[key];
    if (v !== undefined && (!Number.isInteger(v) || v < 0)) {
      throw new Error('Order limits must be whole numbers (0 disables a limit)');
    }
  }
}

export async function updateSettings(patch: Partial<SystemSettings>): Promise<void> {
  validate(patch);

  const actorId = await requireAdmin();

  const admin = createAdminClient();
  const { error } = await admin
    .from('system_settings')
    .update({ ...patch, updated_by: actorId })
    .eq('id', 1);

  if (error) {
    // Pre-053 degrade: the caps section saves ONLY cap keys, so there's
    // nothing to salvage from the patch — just name the missing migration.
    const capKeys = ['max_items_per_order', 'max_active_orders', 'max_orders_per_day'];
    if (Object.keys(patch).some((k) => capKeys.includes(k))) {
      throw new Error(`Order limits need migration 053 applied first (${error.message})`);
    }
    // Pre-050 degrade (042 pattern): don't lose the other fields because the
    // first_order_free column doesn't exist yet.
    if ('first_order_free' in patch) {
      const { first_order_free: _drop, ...rest } = patch;
      void _drop;
      const retry = await admin
        .from('system_settings')
        .update({ ...rest, updated_by: actorId })
        .eq('id', 1);
      if (!retry.error) {
        revalidatePath('/admin/settings');
        throw new Error('Saved — except “First order ships free”, which needs migration 050 applied first.');
      }
    }
    throw new Error(error.message);
  }

  revalidatePath('/admin/settings');
}
