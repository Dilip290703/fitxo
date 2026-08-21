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

  // Created in the previous stage, before the order existed — see order.mjs.
  const manager = ctx.manager;

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
  // The notification KIND lives in data->>kind, not in `type` — every row
  // these triggers write is type='order_update', and the kind is what the
  // panels actually switch on. Asserting on `type` looks green-adjacent and
  // proves nothing.
  const kindsOf = (rows) => (rows ?? []).map((n) => n.data?.kind ?? `(${n.type})`);
  const { data: storeNotifs } = await admin
    .from('notifications').select('type, data').eq('user_id', manager.id);
  report.check(
    'the store manager was notified of the new order',
    kindsOf(storeNotifs).includes('new_store_order'),
    kindsOf(storeNotifs).join(',') || 'none',
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

  // The store-fulfilment gate: nothing leaves the shop until the store has
  // marked every line ready. This is the same condition the admin order screen
  // surfaces as "Waiting for the store to mark all items ready (2/3)".
  const { error: earlyPickup } = await rider.client.rpc('rider_mark_picked_up', { p_delivery_id: delivery.id });
  report.expectError(
    'the rider CANNOT pick up before the store marks the items ready',
    earlyPickup,
    'not marked all items ready',
  );

  const { error: prepErr } = await manager.client
    .rpc('mark_order_items_prepared', { p_order_id: order.order_id, p_ready: true });
  report.check('the store marks every item ready for pickup', !prepErr, prepErr?.message ?? 'all items prepared');

  // Drive the REAL rider steps rather than calling start_try_window directly.
  // It is granted to `authenticated`, so the service role gets "not authorised"
  // — and going through the rider's own path is what makes the try window's
  // "starts on arrival" claim mean anything.
  const { error: pickErr } = await rider.client.rpc('rider_mark_picked_up', { p_delivery_id: delivery.id });
  report.check('rider marks the order picked up', !pickErr, pickErr?.message ?? 'picked up');

  const { error: arriveErr } = await rider.client.rpc('rider_mark_arrived', { p_delivery_id: delivery.id });
  report.check('rider marks arrival at the door', !arriveErr, arriveErr?.message ?? 'arrived');

  // The doorstep OTP is the customer's, read here as admin because this suite
  // has no customer screen to read it off.
  const { data: withOtp } = await admin
    .from('deliveries').select('delivery_otp').eq('id', delivery.id).maybeSingle();
  const { error: delivErr } = await rider.client
    .rpc('rider_mark_delivered', { p_delivery_id: delivery.id, p_otp: withOtp?.delivery_otp ?? '' });
  report.check('rider completes the handover (doorstep OTP)', !delivErr, delivErr?.message ?? `otp=${withOtp?.delivery_otp ?? 'none set'}`);

  // The CUSTOMER opens the window, not the rider: 048 gates on
  // `orders.user_id = auth.uid()`, and the call site is the customer's
  // order-tracking page. Worth stating because it is easy to assume the person
  // standing at the door is the one who starts the clock — they are not, and a
  // rider calling this gets 'not authorised'.
  const before = new Date();
  const { error: startErr } = await customer.client.rpc('start_try_window', { p_order_id: order.order_id });
  report.check('the customer opens the try window from the tracking page', !startErr, startErr?.message ?? 'started');

  const { data: openedOrder } = await admin.from('orders').select('status').eq('id', order.order_id).single();
  report.check(
    'the order is now in its try window',
    openedOrder?.status === 'try_window_active',
    `status=${openedOrder?.status}`,
  );

  const { data: session } = await admin
    .from('try_sessions').select('started_at, deadline_at, status').eq('order_id', order.order_id).maybeSingle();
  if (session) {
    const mins = Math.round((new Date(session.deadline_at) - new Date(session.started_at)) / 60000);
    // Two separate claims. The length one alone would pass against the
    // PLACEHOLDER session place_order creates at checkout — so the second
    // assertion, that the clock was (re)started at the door, is the one that
    // actually tests the product's central promise.
    report.check(
      'the window is settings-length',
      mins === Number(settings.try_window_minutes),
      `${mins}m vs settings ${settings.try_window_minutes}m`,
    );
    report.check(
      'the clock started at the DOOR, not at checkout',
      new Date(session.started_at) >= new Date(before.getTime() - 2000),
      `started_at=${session.started_at}, rider arrived ~${before.toISOString()}`,
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
    .from('notifications').select('type, data').eq('user_id', rider.id);
  report.check(
    'the rider is told about the decisions (023)',
    kindsOf(riderNotifs).some((k) => /item_(kept|returned)/.test(k)),
    kindsOf(riderNotifs).join(',') || 'none',
  );

  const { data: mgrNotifs } = await admin
    .from('notifications').select('type, data').eq('user_id', manager.id);
  report.check(
    'the STORE is told about the decisions (060 — this was the bug)',
    kindsOf(mgrNotifs).some((k) => /item_(kept|returned)/.test(k)),
    kindsOf(mgrNotifs).join(',') || 'none',
  );

  report.heading('stock and settlement');

  const { data: variantNow } = await admin
    .from('product_variants').select('stock_qty, reserved_qty, available_qty').eq('id', store.variantId).single();
  report.check(
    'a returned unit goes back to available stock (047 triggers)',
    Number(variantNow.reserved_qty) < Number(ctx.variantAfterOrder.reserved_qty),
    `reserved ${ctx.variantAfterOrder.reserved_qty} → ${variantNow.reserved_qty}, available=${variantNow.available_qty}`,
  );

  const { error: finErr } = await customer.client.rpc('finalize_order_if_decided', { p_order_id: order.order_id });
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
