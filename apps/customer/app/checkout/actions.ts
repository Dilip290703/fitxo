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

  // ── Server-side pricing (G2) ──────────────────────────────────────────────
  // NEVER trust the client's priceValue: the browser owns the cart, so a
  // tampered request could otherwise buy a ₹5000 item for ₹1 — and the Keep
  // charge later trusts price_at_order verbatim. Resolve every price from the
  // DB here. RLS already hides inactive/deleted products and inactive stores
  // from this (customer) session, so a missing row means "not sellable".
  const productIds = [...new Set(items.map((i) => i.id))];
  const { data: dbProducts, error: productsError } = await supabase
    .from('products')
    .select('id, name, base_price, discounted_price, store_id, stores(onboarding_status, is_active)')
    .in('id', productIds);
  if (productsError) {
    return { success: false, error: productsError.message };
  }
  const productById = new Map((dbProducts ?? []).map((p) => [p.id, p]));

  const pricing: Record<string, { unitPrice: number; name: string; quantity: number }> = {};
  for (const item of items) {
    const product = productById.get(item.id);
    if (!product) {
      return { success: false, error: `"${item.title}" is no longer available.` };
    }

    // The store must be live: approved through onboarding AND active. The
    // stores row itself is RLS-hidden when inactive, so `null` fails too.
    const store = Array.isArray(product.stores) ? product.stores[0] : product.stores;
    if (!store || store.is_active !== true || store.onboarding_status !== 'approved') {
      return {
        success: false,
        error: `"${item.title}" isn't available right now — its store is not live on Fitzo.`,
      };
    }

    // Effective price: discounted_price when set, else base_price. A missing
    // or non-positive price (e.g. a malformed bulk-upload row) is not sellable.
    const unitPrice = Number(product.discounted_price ?? product.base_price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return {
        success: false,
        error: `"${product.name}" can't be ordered right now. Please remove it and try again.`,
      };
    }

    // Quantity comes from the client too — keep it a small positive integer.
    // (Real per-customer order caps are G5; this only blocks nonsense values.)
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 25) {
      return { success: false, error: `Invalid quantity for "${product.name}".` };
    }

    pricing[item.key] = { unitPrice, name: product.name, quantity };
  }

  // ── Single-store cart (G1) ────────────────────────────────────────────────
  // One order = one delivery = one rider picking up from ONE store; the
  // doorstep try-on can't span shops. The bag UI already prevents mixing
  // (StoreConflictModal), so this only fires on tampered/legacy carts.
  const storeIds = new Set(
    items.map((item) => productById.get(item.id)?.store_id).filter(Boolean),
  );
  if (storeIds.size > 1) {
    return {
      success: false,
      error:
        'Your bag has items from more than one store. A Fitzo order is delivered from a single store — please order them separately.',
    };
  }

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

  // Money math uses ONLY server-resolved prices from here on.
  const subtotal = items.reduce(
    (sum, i) => sum + pricing[i.key].unitPrice * pricing[i.key].quantity,
    0,
  );

  // Fees from Admin → System Settings.
  //   • delivery_fee  = what the CUSTOMER is charged (free above the threshold).
  //   • rider_fee     = what the RIDER earns per completed delivery — a platform
  //     cost, always paid regardless of the customer's free-delivery waiver.
  // These are deliberately separate (migration 037): agent earnings + Admin >
  // Agent Payouts read orders.rider_fee, never delivery_fee.
  const { data: settings } = await supabase
    .from('system_settings')
    .select('delivery_fee, free_delivery_above, rider_fee, try_window_minutes')
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

  // Create one order_items row per unit (schema has no quantity column — each unit is a row).
  // product_name and price_at_order are the DB-resolved values: the Keep charge
  // (createKeepPayment) trusts price_at_order, so nothing client-supplied may
  // reach it.
  const orderItemRows = items.flatMap((item) => {
    const r = resolved[item.key];
    const p = pricing[item.key];
    return Array.from({ length: p.quantity }, () => ({
      order_id: order.id,
      product_id: item.id,
      variant_id: r.variantId,
      product_name: p.name,
      color_name: r.colorName,
      size: r.size,
      image_url: item.image || null,
      price_at_order: p.unitPrice,
      deposit_at_order: 0,
      decision: 'pending' as const,
    }));
  });

  const { error: itemsError } = await supabase.from('order_items').insert(orderItemRows);
  if (itemsError) {
    return { success: false, error: itemsError.message };
  }

  // Create try_session. The real window is the rider's wait at the door, which
  // starts when the customer accepts after the rider marks delivered — the
  // start_try_window RPC resets started_at/deadline_at then. This deadline is a
  // placeholder until that moment. Duration comes from Admin → System Settings
  // (system_settings.try_window_minutes) — the ONE source of truth (A3).
  const tryWindowMinutes = Number(settings?.try_window_minutes ?? 7);
  const startedAt = new Date();
  const deadlineAt = new Date(startedAt.getTime() + tryWindowMinutes * 60 * 1000);

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
