'use server';

import { createClient } from '@fitzo/supabase/server';
import type { CartItem } from '@/components/cart/CartProvider';
import { isPunePincode } from '@/lib/pincode';

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
  addressId: string,
): Promise<PlaceOrderResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'You must be logged in to place an order.' };
  }

  if (items.length === 0) {
    return { success: false, error: 'Your cart is empty.' };
  }

  // The order must carry a real, deliverable address — the rider's drop card
  // and the admin order detail read it. RLS on `addresses` means this query
  // only returns a row the caller owns, so ownership is enforced by the DB.
  if (!addressId) {
    return { success: false, error: 'Please add a delivery address.' };
  }
  const { data: address } = await supabase
    .from('addresses')
    .select('id, user_id, pincode')
    .eq('id', addressId)
    .maybeSingle();
  if (!address || address.user_id !== user.id) {
    return { success: false, error: 'That delivery address could not be found.' };
  }
  if (!isPunePincode(String(address.pincode ?? ''))) {
    return { success: false, error: 'FitZo currently delivers only to Pune pincodes.' };
  }

  const paymentMethod = METHOD_MAP[paymentMethodLabel] ?? 'razorpay';

  // Resolve a concrete product_variant for each cart item. Prefer the chosen
  // colour/size, but gracefully fall back to the product's first available
  // variant so an item added without an explicit selection doesn't block checkout.
  const resolved: Record<string, { variantId: string; colorName: string; size: string }> = {};
  for (const item of items) {
    const { data: colors } = await supabase
      .from('product_colors')
      .select('id, color_name')
      .eq('product_id', item.id);

    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, size, color_id')
      .eq('product_id', item.id);

    if (!colors?.length || !variants?.length) {
      return { success: false, error: `${item.title} is currently unavailable.` };
    }

    // Chosen colour if it exists, else the product's first colour.
    const color =
      (item.color && colors.find((c) => c.color_name === item.color)) || colors[0];

    // Chosen size for that colour, else any variant for that colour, else any variant.
    const variant =
      (item.size && variants.find((v) => v.color_id === color.id && v.size === item.size)) ||
      variants.find((v) => v.color_id === color.id) ||
      variants[0];

    // Keep the stored colour name consistent with the variant we actually picked.
    const variantColor = colors.find((c) => c.id === variant.color_id) ?? color;

    resolved[item.key] = {
      variantId: variant.id,
      colorName: variantColor.color_name,
      size: variant.size,
    };
  }

  const subtotal = items.reduce((sum, i) => sum + i.priceValue * i.quantity, 0);

  // Fees from Admin → System Settings.
  //   • delivery_fee  = what the CUSTOMER is charged (free above the threshold).
  //   • rider_fee     = what the RIDER earns per completed delivery — a platform
  //     cost, always paid regardless of the customer's free-delivery waiver.
  // These are deliberately separate (migration 037): agent earnings + Admin >
  // Agent Payouts read orders.rider_fee, never delivery_fee.
  const { data: settings } = await supabase
    .from('system_settings')
    .select('delivery_fee, free_delivery_above, rider_fee')
    .eq('id', 1)
    .maybeSingle();
  const feeConfig = Number(settings?.delivery_fee ?? 0);
  const freeAbove = Number(settings?.free_delivery_above ?? 0);
  const deliveryFee = freeAbove > 0 && subtotal >= freeAbove ? 0 : feeConfig;
  const riderFee = Number(settings?.rider_fee ?? 0);
  const finalAmount = subtotal + deliveryFee;

  // Create order (order_number set by DB trigger when passed as empty string)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      order_number: '',
      address_id: address.id,
      status: 'pending',
      subtotal,
      deposit_total: 0,
      delivery_fee: deliveryFee,
      rider_fee: riderFee,
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
  const orderItemRows = items.flatMap((item) => {
    const r = resolved[item.key];
    return Array.from({ length: item.quantity }, () => ({
      order_id: order.id,
      product_id: item.id,
      variant_id: r.variantId,
      product_name: item.title,
      color_name: r.colorName,
      size: r.size,
      image_url: item.image || null,
      price_at_order: item.priceValue,
      deposit_at_order: 0,
      decision: 'pending' as const,
    }));
  });

  const { error: itemsError } = await supabase.from('order_items').insert(orderItemRows);
  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  // Create try_session. The real window is the rider's 7-minute wait, which
  // starts when the customer accepts after the rider marks delivered — the agent
  // flow resets started_at/deadline_at then. This is a placeholder until then.
  // (TODO: move duration to Admin settings; see docs/PROGRESS.md Known issues.)
  const TRY_WINDOW_MINUTES = 7;
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
