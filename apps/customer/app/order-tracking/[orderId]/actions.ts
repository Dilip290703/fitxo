'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@fitzo/supabase/server';

type ActionResult = { success: true } | { success: false; error: string };

export async function keepItem(orderItemId: string, orderId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated.' };

  const { error } = await supabase
    .from('order_items')
    .update({ decision: 'keep', decision_at: new Date().toISOString() })
    .eq('id', orderItemId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/order-tracking/${orderId}`);
  return { success: true };
}

export async function returnItem(orderItemId: string, orderId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated.' };

  const { error: updateError } = await supabase
    .from('order_items')
    .update({ decision: 'return', decision_at: new Date().toISOString() })
    .eq('id', orderItemId);

  if (updateError) return { success: false, error: updateError.message };

  const { error: returnError } = await supabase
    .from('returns')
    .insert({
      order_id: orderId,
      order_item_id: orderItemId,
      status: 'requested',
      requested_at: new Date().toISOString(),
    });

  if (returnError) return { success: false, error: returnError.message };

  revalidatePath(`/order-tracking/${orderId}`);
  return { success: true };
}
