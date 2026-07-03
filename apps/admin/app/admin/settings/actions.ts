'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@fitzo/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';

export interface SystemSettings {
  site_name: string;
  contact_email: string;
  support_phone: string;
  try_window_minutes: number;
  delivery_fee: number;
  free_delivery_above: number;
  commission_rate: number;
}

// Mirrors the migration 011 defaults — used if the singleton row is somehow missing.
const DEFAULTS: SystemSettings = {
  site_name: 'Fitzo',
  contact_email: 'support@fitzo.in',
  support_phone: '',
  try_window_minutes: 1440,
  delivery_fee: 49,
  free_delivery_above: 999,
  commission_rate: 15,
};

export async function getSettings(): Promise<SystemSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('system_settings')
    .select(
      'site_name, contact_email, support_phone, try_window_minutes, delivery_fee, free_delivery_above, commission_rate',
    )
    .eq('id', 1)
    .maybeSingle();

  return { ...DEFAULTS, ...(data ?? {}) } as SystemSettings;
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
  if (patch.commission_rate !== undefined && (!Number.isFinite(patch.commission_rate) || patch.commission_rate < 0 || patch.commission_rate > 100)) {
    throw new Error('Commission rate must be between 0 and 100');
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

  if (error) throw new Error(error.message);

  revalidatePath('/admin/settings');
}
