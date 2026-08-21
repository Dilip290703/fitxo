/**
 * The rest of the loop: fee gate → store confirm → rider → try window →
 * keep/return → settle. This is the stretch that has never run on production
 * and has had zero automated coverage.
 */
export async function fulfilmentSuite(world, report, ctx) {
  const { admin } = world;
  const { settings, order, customer, store } = ctx;
  if (!order) {
    report.skip('fulfilment', 'no order was placed — earlier stage failed');
    return ctx;
  }

  report.heading('delivery fee gate (G9/050)');

  const manager = await world.createStoreManager(store.id);
  ctx.manager = manager;

  const feeDue = Number(settings.first_order_free ? 0 : settings.delivery_fee) > 0;

  if (feeDue) {
    const { error } = await manager.client.rpc('store_confirm_order', { p_order_id: order.order_id });
    report.expectError(
      'the store CANNOT confirm an order whose fee is unpaid',
      error,
      'DELIVERY_FEE_UNPAID',
    );
  } else {
    report.skip('fee gate', 'no fee is due on this order (first_order_free)');
  }

  // Simulate the captured fee payment. THIS IS THE SUITE'S BIGGEST LIMITATION
  // and it is deliberate: Razorpay's API is not exercised. What is being tested
  // is the gate's contract — "a payments row with status=success and a
  // delivery_fee_component releases the order" — not that Razorpay charged
  // anyone. The real gateway path is proven by a browser payment (see README).
  const { data: payment, error: payErr } = await admin
    .from('payments')
    .insert({
      order_id: order.order_id,
      user_id: customer.id,
      amount: Number(settings.delivery_fee),
      status: 'success',
      payment_method: 'razorpay',
      razorpay_order_id: `order_e2e_${world.runId}`,
      razorpay_payment_id: `pay_e2e_${world.runId}`,
      delivery_fee_component: Number(settings.delivery_fee),
      paid_at: new Date().toISOString(),
    })
    .select('id').single();
  report.check('simulated fee payment recorded', !payErr, payErr?.message ?? `payment ${payment?.id}`);
  ctx.paymentId = payment?.id;

  report.heading('store confirms');

  const { error: confirmErr } = await manager.client.rpc('store_confirm_order', { p_order_id: order.order_id });
  report.check('the store can confirm once the fee is paid', !confirmErr, confirmErr?.message ?? 'confirmed');

  const { data: confirmed } = await admin.from('orders').select('status').eq('id', order.order_id).single();
  report.check('order moved to confirmed', confirmed?.status === 'confirmed', `status=${confirmed?.status}`);

  // The store must have been told about the order in the first place.
  const { data: storeNotifs } = await admin
    .from('notifications').select('type, title').eq('user_id', manager.id);
  report.check(
    'the store manager was notified of the new order',
    (storeNotifs ?? []).some((n) => String(n.type).includes('store_order') || /order/i.test(n.title ?? '')),
    `${(storeNotifs ?? []).length} notification(s): ${(storeNotifs ?? []).map((n) => n.type).join(',') || 'none'}`,
  );

  report.heading('rider takes the job');

  const rider = await world.createRider();
  ctx.rider = rider;

  const { data: delivery } = await admin
    .from('deliveries').select('id, status, rider_id, drop_address').eq('order_id', order.order_id).maybeSingle();
  if (!report.check('a delivery row exists for the order', !!delivery, delivery ? `status=${delivery.status}` : 'missing')) {
    return ctx;
  }
  report.check(
    'the drop address was copied onto the delivery (rider drop card)',
    !!delivery.drop_address && Object.keys(delivery.drop_address).length > 0,
    JSON.stringify(delivery.drop_address ?? {}).slice(0, 80),
  );

  const { error: claimErr } = await rider.client.rpc('rider_claim_delivery', { p_delivery_id: delivery.id });
  report.check('rider claims the delivery', !claimErr, claimErr?.message ?? 'claimed');

  const { data: claimed } = await admin.from('deliveries').select('rider_id, status').eq('id', delivery.id).single();
  report.check('the delivery now belongs to that rider', claimed?.rider_id === rider.riderId, `rider_id=${claimed?.rider_id}`);

  // Once a rider holds it, the customer's cancel window is closed (054).
  const { error: lateCancel } = await customer.client.rpc('cancel_order_by_customer', { p_order_id: order.order_id });
  report.expectError(
    'the customer can no longer cancel once a rider has claimed it',
    lateCancel,
    'CANCEL_RIDER_ASSIGNED',
  );

  report.heading('try window opens on arrival, not at checkout');

  const before = new Date();
  const { error: startErr } = await admin.rpc('start_try_window', { p_order_id: order.order_id });
  report.check('start_try_window runs', !startErr, startErr?.message ?? 'started');

  const { data: session } = await admin
    .from('try_sessions').select('started_at, deadline_at, status').eq('order_id', order.order_id).maybeSingle();
  if (session) {
    const mins = Math.round((new Date(session.deadline_at) - new Date(session.started_at)) / 60000);
    report.check(
      'the window is settings-length and starts NOW, not at checkout',
      mins === Number(settings.try_window_minutes) && new Date(session.started_at) >= new Date(before.getTime() - 60000),
      `${mins}m, started_at=${session.started_at}`,
    );
  }

  report.heading('keep / return — the decision the whole product exists for');

  const { data: items } = await admin.from('order_items').select('id').eq('order_id', order.order_id).order('id');
  const [keepItem, returnItem] = items;

  const { error: keepErr } = await customer.client
    .from('order_items').update({ decision: 'keep', decision_at: new Date().toISOString() }).eq('id', keepItem.id);
  report.check('customer can decide KEEP on their own item', !keepErr, keepErr?.message ?? 'kept');

  const { error: retErr } = await customer.client
    .from('order_items').update({ decision: 'return', decision_at: new Date().toISOString() }).eq('id', returnItem.id);
  report.check('customer can decide RETURN on their own item', !retErr, retErr?.message ?? 'returned');

  // Migration 023 notifies the rider; migration 060 added the store side. This
  // is the exact gap the store panel had: the row was written and the client
  // threw it away, so assert the ROW, which is what 060 guarantees.
  const { data: riderNotifs } = await admin
    .from('notifications').select('type').eq('user_id', rider.id);
  report.check(
    'the rider is told about the decisions (023)',
    (riderNotifs ?? []).some((n) => /item_(kept|returned)/.test(n.type)),
    `${(riderNotifs ?? []).map((n) => n.type).join(',') || 'none'}`,
  );

  const { data: mgrNotifs } = await admin
    .from('notifications').select('type').eq('user_id', manager.id);
  report.check(
    'the STORE is told about the decisions (060 — this was the bug)',
    (mgrNotifs ?? []).some((n) => /item_(kept|returned)/.test(n.type)),
    `${(mgrNotifs ?? []).map((n) => n.type).join(',') || 'none'}`,
  );

  report.heading('stock and settlement');

  const { data: variantNow } = await admin
    .from('product_variants').select('stock_qty, reserved_qty, available_qty').eq('id', store.variantId).single();
  report.check(
    'a returned unit goes back to available stock (047 triggers)',
    Number(variantNow.reserved_qty) < Number(ctx.variantAfterOrder.reserved_qty),
    `reserved ${ctx.variantAfterOrder.reserved_qty} → ${variantNow.reserved_qty}, available=${variantNow.available_qty}`,
  );

  const { error: finErr } = await admin.rpc('finalize_order_if_decided', { p_order_id: order.order_id });
  report.check('finalize_order_if_decided runs once every item is decided', !finErr, finErr?.message ?? 'finalized');

  const { data: finalOrder } = await admin.from('orders').select('status, payment_status').eq('id', order.order_id).single();
  report.info(`order ended at status=${finalOrder?.status}, payment_status=${finalOrder?.payment_status}`);

  report.heading('economics agree with the arithmetic');

  const { data: econ } = await admin
    .from('order_economics').select('*').eq('order_id', order.order_id).maybeSingle();
  if (!econ) {
    report.skip('order_economics row', 'no row for this order (it may require a settled keep payment)');
  } else {
    report.check(
      'delivery fee collected matches the payment row',
      Number(econ.delivery_fee_collected) === Number(settings.delivery_fee),
      `economics ₹${econ.delivery_fee_collected} vs payment ₹${settings.delivery_fee}`,
    );
    report.info(`economics: ${JSON.stringify(econ).slice(0, 200)}`);
  }

  return ctx;
}
