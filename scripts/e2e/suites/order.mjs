/**
 * place_order: the single most load-bearing function in the product. It is the
 * only door onto stock reservation, server-side pricing and the abuse caps,
 * and every one of those is a thing a hostile client would rather bypass.
 */
export async function orderSuite(world, report, ctx) {
  const { admin } = world;
  const { settings } = ctx;

  report.heading('place_order — happy path');

  const store = await world.createStore({ stock: 20, price: 799 });
  const customer = await world.createCustomer('buyer');
  ctx.store = store;

  // The client sends a price. It is a lie, on purpose: G2 says the server must
  // resolve price from the database and ignore whatever the cart claims.
  const { data: placed, error: placeErr } = await customer.client.rpc('place_order', {
    p_items: [{ product_id: store.productId, quantity: 2, size: 'M', color_name: 'Test Black', price: 1 }],
    p_payment_method: 'razorpay',
    p_address_id: customer.addressId,
  });

  if (!report.check('place_order succeeds for a signed-in customer', !placeErr && !!placed, placeErr?.message ?? `order ${placed?.order_number}`)) {
    return ctx;
  }
  world.trackOrder(placed.order_id);
  ctx.order = placed;
  ctx.customer = customer;

  report.check('order number uses the FTX- prefix (059)', String(placed.order_number).startsWith('FTX-'), placed.order_number);

  const { data: order } = await admin
    .from('orders')
    .select('id, status, subtotal, delivery_fee, final_amount, payment_status, user_id, address_id')
    .eq('id', placed.order_id).single();

  const expectedSubtotal = store.price * 2;
  report.check(
    'price came from the DB, not the client (G2)',
    Number(order.subtotal) === expectedSubtotal,
    `subtotal ₹${order.subtotal}, expected ₹${expectedSubtotal} — client claimed ₹1/unit`,
  );
  report.check('order starts pending', order.status === 'pending', `status=${order.status}`);
  report.check('address stamped on the order (A1)', order.address_id === customer.addressId, `address_id=${order.address_id}`);

  const expectedFee = settings.first_order_free ? 0 : Number(settings.delivery_fee);
  report.check(
    'delivery fee matches settings, not a constant',
    Number(order.delivery_fee) === expectedFee,
    `₹${order.delivery_fee} (settings ₹${settings.delivery_fee}, first_order_free=${settings.first_order_free})`,
  );

  const { data: items } = await admin.from('order_items').select('id, decision, price_at_order').eq('order_id', placed.order_id);
  report.check('one order_item row PER UNIT, not per line', items.length === 2, `${items.length} row(s) for quantity 2`);
  report.check('items start undecided', items.every((i) => i.decision === 'pending'), items.map((i) => i.decision).join(','));

  const { data: variant } = await admin.from('product_variants').select('stock_qty, reserved_qty, available_qty').eq('id', store.variantId).single();
  report.check(
    'stock reserved under the order (G3/047)',
    Number(variant.reserved_qty) === 2,
    `reserved=${variant.reserved_qty}, available=${variant.available_qty} of ${variant.stock_qty}`,
  );
  ctx.variantAfterOrder = variant;

  const { data: trySession } = await admin.from('try_sessions').select('id, status, started_at, deadline_at').eq('order_id', placed.order_id).maybeSingle();
  report.check('a try session exists for the order', !!trySession, trySession ? `status=${trySession.status}` : 'missing');
  if (trySession) {
    const mins = Math.round((new Date(trySession.deadline_at) - new Date(trySession.started_at)) / 60000);
    report.check(
      'try window length comes from settings (A3/048)',
      mins === Number(settings.try_window_minutes),
      `${mins}m vs settings ${settings.try_window_minutes}m`,
    );
  }

  // ── the refusals ────────────────────────────────────────────────────────
  report.heading('place_order — guards (each of these is a way to lose money)');

  const guard = async (name, items, addressId, expected, client = customer.client) => {
    const { error } = await client.rpc('place_order', {
      p_items: items, p_payment_method: 'razorpay', p_address_id: addressId,
    });
    report.expectError(name, error, expected);
  };

  const line = (over = {}) => [{ product_id: store.productId, quantity: 1, size: 'M', color_name: 'Test Black', ...over }];

  await guard('empty cart is rejected', [], customer.addressId, 'EMPTY_CART');
  await guard('missing address is rejected (A1)', line(), null, 'ADDRESS_REQUIRED');
  await guard(
    "another user's address is rejected",
    line(),
    '00000000-0000-0000-0000-000000000000',
    'ADDRESS_INVALID',
  );

  // The live cap is normally 1 active order, and this customer already has one,
  // so that guard fires before anything else can be tested on this account.
  if (Number(settings.max_active_orders) > 0) {
    await guard('a second live order hits the active-order cap (G5/053)', line(), customer.addressId, 'ORDER_LIMIT_ACTIVE');
  } else {
    report.skip('active-order cap', 'max_active_orders is 0 (disabled) on this environment');
  }

  // Remaining guards need a customer with no active order of their own.
  const fresh = await world.createCustomer('guards');

  if (Number(settings.max_items_per_order) > 0) {
    await guard(
      'the per-order item cap is enforced (G5/053)',
      line({ quantity: 10 }).concat(line({ quantity: 10 })),
      fresh.addressId,
      'ORDER_TOO_MANY_ITEMS',
      fresh.client,
    );
  } else {
    report.skip('per-order item cap', 'max_items_per_order is 0 (disabled)');
  }

  await guard(
    'an unknown product is rejected',
    [{ product_id: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
    fresh.addressId,
    'PRODUCT_UNAVAILABLE',
    fresh.client,
  );

  await guard(
    'quantity 0 is rejected',
    line({ quantity: 0 }),
    fresh.addressId,
    'INVALID_QUANTITY',
    fresh.client,
  );

  // Two stores in one cart (G1 backstop).
  const store2 = await world.createStore({ stock: 5, price: 499 });
  await guard(
    'a mixed-store cart is rejected server-side (G1)',
    line().concat([{ product_id: store2.productId, quantity: 1 }]),
    fresh.addressId,
    'MULTI_STORE_CART',
    fresh.client,
  );

  // Out of stock: ask for more than exists.
  await guard(
    'ordering beyond available stock is rejected',
    [{ product_id: store2.productId, quantity: 9 }],
    fresh.addressId,
    'OUT_OF_STOCK',
    fresh.client,
  );

  // Paused store (G6/052) — pause it through the RPC the store panel uses.
  const mgr2 = await world.createStoreManager(store2.id);
  const { error: pauseErr } = await mgr2.client.rpc('store_set_paused', { p_store_id: store2.id, p_paused: true });
  if (pauseErr) {
    report.skip('paused store refuses new orders (G6/052)', `store_set_paused failed: ${pauseErr.message}`);
  } else {
    await guard(
      'a paused store refuses new orders (G6/052)',
      [{ product_id: store2.productId, quantity: 1 }],
      fresh.addressId,
      'STORE_PAUSED',
      fresh.client,
    );
    await mgr2.client.rpc('store_set_paused', { p_store_id: store2.id, p_paused: false });
  }

  // ── RLS on rows this suite just created ─────────────────────────────────
  report.heading('RLS — a real order, seen from the outside');

  const { data: anonOrder } = await world.anon.from('orders').select('id').eq('id', placed.order_id);
  report.check('anon cannot read this order', (anonOrder ?? []).length === 0, `${(anonOrder ?? []).length} row(s) visible to anon`);

  const { data: otherOrder } = await fresh.client.from('orders').select('id').eq('id', placed.order_id);
  report.check(
    "a different signed-in customer cannot read someone else's order",
    (otherOrder ?? []).length === 0,
    `${(otherOrder ?? []).length} row(s) visible cross-account`,
  );

  const { data: ownOrder } = await customer.client.from('orders').select('id').eq('id', placed.order_id);
  report.check('the owner CAN read their own order (not over-locked)', (ownOrder ?? []).length === 1, `${(ownOrder ?? []).length} row(s)`);

  return ctx;
}
