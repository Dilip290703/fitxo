'use server';

import { createClient } from '@fitzo/supabase/server';
import type { CartItem } from '@/components/cart/CartProvider';

export type PlaceOrderResult =
  | { success: true; orderId: string; orderNumber: string }
  | { success: false; error: string };

const METHOD_MAP: Record<string, 'razorpay' | 'cod' | 'wallet'> = {
  UPI: 'razorpay',
  Card: 'razorpay',
  'Pay Later': 'wallet',
  'Cash on Delivery': 'cod',
};

export async function placeOrder(
  items: CartItem[],
  paymentMethodLabel: string,
): Promise<PlaceOrderResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to place an order.' };
  }

  if (items.length === 0) {
    return { success: false, error: 'Your cart is empty.' };
  }

  const paymentMethod = METHOD_MAP[paymentMethodLabel] ?? 'razorpay';

  // Resolve variant ID for each cart item (product_id + color_name + size → variant UUID)
  const variantIds: Record<string, string> = {};
  for (const item of items) {
    const { data: color } = await supabase
      .from('product_colors')
      .select('id')
      .eq('product_id', item.id)
      .eq('color_name', item.color)
      .maybeSingle();

    if (!color) {
      return { success: false, error: `Colour "${item.color}" not found for ${item.title}.` };
    }

    const { data: variant } = await supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', item.id)
      .eq('color_id', color.id)
      .eq('size', item.size)
      .maybeSingle();

    if (!variant) {
      return { success: false, error: `Variant not found for ${item.title} (${item.color}, ${item.size}).` };
    }

    variantIds[item.key] = variant.id;
  }

  const subtotal = items.reduce((sum, i) => sum + i.priceValue * i.quantity, 0);
  const finalAmount = subtotal; // no delivery fee at MVP

  // Create order (order_number set by DB trigger when passed as empty string)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      order_number: '',
      status: 'pending',
      subtotal,
      deposit_total: 0,
      delivery_fee: 0,
      discount_amount: 0,
      final_amount: finalAmount,
      coupon_discount: 0,
      payment_status: 'pending',
      payment_method: paymentMethod,
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) {
    return { success: false, error: orderError?.message ?? 'Failed to create order.' };
  }

  // Create one order_items row per unit (schema has no quantity column — each unit is a row)
  const orderItemRows = items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      order_id: order.id,
      product_id: item.id,
      variant_id: variantIds[item.key],
      product_name: item.title,
      color_name: item.color,
      size: item.size,
      image_url: item.image || null,
      price_at_order: item.priceValue,
      deposit_at_order: 0,
      decision: 'pending' as const,
    })),
  );

  const { error: itemsError } = await supabase.from('order_items').insert(orderItemRows);
  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  // Create try_session. The real window is the rider's 15–30 min wait, which
  // starts when the rider ARRIVES — the agent panel resets started_at/deadline_at
  // on delivery. This is a placeholder until then. (TODO: move duration to Admin
  // settings; see docs/PROGRESS.md Known issues.)
  const TRY_WINDOW_MINUTES = 30;
  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + TRY_WINDOW_MINUTES * 60 * 1000);

  const { error: sessionError } = await supabase.from('try_sessions').insert({
    order_id: order.id,
    started_at: startedAt.toISOString(),
    deadline_at: deadlineAt.toISOString(),
    status: 'active',
  });

  if (sessionError) {
    return { success: false, error: sessionError.message };
  }

  return { success: true, orderId: order.id, orderNumber: order.order_number };
}
