import { createClient } from '@supabase/supabase-js';

/**
 * Read-only. Establishes what the environment IS before anything asserts what
 * it should do — and captures the money-queue baseline the residue suite
 * compares against at the end.
 *
 * Runs against production too (that is the point of --preflight): it never
 * writes.
 */
export async function preflight(env, report) {
  report.heading('preflight — environment');

  const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
  const anon = createClient(env.url, env.anonKey, { auth: { persistSession: false } });

  report.info(`project ${env.ref} (${env.url})`);

  // ── settings drive the suite's expectations, so read them, never assume ──
  const { data: settings, error: sErr } = await admin
    .from('system_settings')
    .select('site_name, contact_email, try_window_minutes, commission_rate, delivery_fee, rider_fee, first_order_free, max_items_per_order, max_active_orders, max_orders_per_day')
    .eq('id', 1)
    .single();

  if (!report.check('system_settings singleton readable', !sErr && !!settings, sErr?.message ?? 'row id=1 present')) {
    throw new Error('cannot continue without system_settings');
  }

  report.check('brand is Fitxo (migration 059 applied)', settings.site_name === 'Fitxo', `site_name=${settings.site_name}`);
  report.info(
    `try window ${settings.try_window_minutes}m · commission ${settings.commission_rate}% · fee ₹${settings.delivery_fee} · ` +
    `rider ₹${settings.rider_fee} · caps ${settings.max_items_per_order}/${settings.max_active_orders}/${settings.max_orders_per_day}`,
  );

  // The suite adapts to these rather than writing them. system_settings is
  // shared dev configuration — a test that flips a global toggle and then dies
  // leaves the environment misconfigured for everyone.
  if (settings.first_order_free) {
    report.info('first_order_free is ON — new test customers get a ₹0 fee; the fee-gate stage accounts for this');
  }

  // ── RPCs that are safe to call because they only read ────────────────────
  report.heading('preflight — money-path RPCs respond');

  const probes = [
    ['pending_fee_refunds', () => admin.rpc('pending_fee_refunds')],
    ['stale_offers_needing_refund', () => admin.rpc('stale_offers_needing_refund')],
    ['store_order_economics', () => admin.rpc('store_order_economics')],
    ['razorpay_secret_fingerprints', () => admin.rpc('razorpay_secret_fingerprints')],
    ['validate_coupon', () => admin.rpc('validate_coupon', { p_code: '__e2e_no_such_code__', p_subtotal: 100 })],
  ];

  const baseline = {};
  for (const [name, call] of probes) {
    const { data, error } = await call();
    // A coupon that does not exist is a correct answer, not a failure. What is
    // being probed here is "does this function exist and execute", so only a
    // schema-cache miss counts as broken.
    const missing = error && /Could not find the function/i.test(error.message);
    report.check(`${name}() resolves`, !missing, missing ? error.message : `ok${Array.isArray(data) ? ` (${data.length} row(s))` : ''}`);
    if (Array.isArray(data)) baseline[name] = data.length;
  }

  const { data: econ, error: econErr } = await admin.from('order_economics').select('order_id').limit(1);
  report.check('order_economics view readable', !econErr, econErr?.message ?? `ok (${(econ ?? []).length} sampled)`);

  // ── the public attack surface, on the tables this suite will populate ────
  report.heading('preflight — RLS on the tables this suite touches');

  for (const table of ['users', 'orders', 'order_items', 'payments', 'addresses', 'notifications']) {
    const { data, error } = await anon.from(table).select('id').limit(1);
    const leaked = !error && (data ?? []).length > 0;
    report.check(`anon sees nothing in ${table}`, !leaked, leaked ? 'LEAK — anon read a row' : error ? `blocked (${error.code ?? 'rls'})` : 'no rows visible');
  }

  return { settings, baseline };
}
