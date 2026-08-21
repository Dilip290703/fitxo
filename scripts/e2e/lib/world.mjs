import { createClient } from '@supabase/supabase-js';

/**
 * An isolated world of test data.
 *
 * Every row this suite creates is stamped with a run id and a `e2e-` prefix,
 * for two reasons. Teardown can then find its own rows deterministically
 * instead of guessing from timestamps; and if a run is killed mid-way, the
 * leftovers are identifiable — `--sweep` removes them without a human having
 * to work out which of the 60 dev orders were real.
 *
 * Fixtures are never shared between stages. The live `max_active_orders` cap
 * on dev is 1, so a suite that reused one customer would start failing at the
 * second order for a reason that has nothing to do with what it was testing.
 * One customer per scenario keeps every failure legible.
 */
export class World {
  constructor(env, report) {
    this.env = env;
    this.report = report;
    this.runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.tag = `e2e-${this.runId}`;
    // Per-FIXTURE counter, not just per-run. Several stages need a second store
    // or a second manager, and slug/sku/email are all UNIQUE — namespacing on
    // the run alone collides the moment a suite asks for two of anything.
    this.seq = 0;

    // Service role: fixture construction and the assertions that must see rows
    // regardless of RLS. Never used to exercise the app's own code paths.
    this.admin = createClient(env.url, env.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Anon: the real public attack surface, for the RLS checks.
    this.anon = createClient(env.url, env.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    this.created = {
      authUsers: [], users: [], stores: [], products: [], colors: [],
      variants: [], addresses: [], orders: [], riders: [], storeManagers: [],
    };
  }

  /**
   * A signed-in client. This matters more than it looks: `place_order` is
   * granted to `authenticated` and reads `auth.uid()`, so calling it with the
   * service role gets you "not authenticated", not a bypass. Driving the money
   * path as a real logged-in user is the only way this is an end-to-end test
   * rather than a schema test.
   */
  async createCustomer(label) {
    const n = ++this.seq;
    const email = `${this.tag}+${label}${n}@fitxo.test`;
    const password = `E2e!${this.runId}Pw`;

    const { data: created, error } = await this.admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name: `E2E ${label}` },
    });
    if (error) throw new Error(`createUser(${label}): ${error.message}`);
    this.created.authUsers.push(created.user.id);
    this.created.users.push(created.user.id);

    const client = createClient(this.env.url, this.env.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(`signIn(${label}): ${signInError.message}`);

    // Migration 015's trigger provisions public.users on signup. Nudge the row
    // rather than insert one, so a broken trigger surfaces as a failure here
    // instead of being silently papered over by the fixture.
    await this.admin.from('users').update({ name: `E2E ${label}`, phone: '9000000000' }).eq('id', created.user.id);

    const { data: address, error: addrError } = await this.admin
      .from('addresses')
      .insert({
        user_id: created.user.id, full_name: `E2E ${label}`, phone: '9000000000',
        line1: '1 Test Lane', city: 'Pune', state: 'Maharashtra',
        pincode: '411001', is_default: true,
      })
      .select('id').single();
    if (addrError) throw new Error(`address(${label}): ${addrError.message}`);
    this.created.addresses.push(address.id);

    return { id: created.user.id, email, client, addressId: address.id };
  }

  /** An approved, active, unpaused store with one product in stock. */
  async createStore({ stock = 20, price = 799, discounted = null } = {}) {
    const n = ++this.seq;
    const { data: store, error } = await this.admin
      .from('stores')
      .insert({
        name: `E2E Store ${this.runId}-${n}`, slug: `${this.tag}-store-${n}`,
        city: 'Pune', pincode: '411001', is_active: true, is_verified: true,
        onboarding_status: 'approved',
      })
      .select('id').single();
    if (error) throw new Error(`store: ${error.message}`);
    this.created.stores.push(store.id);

    const { data: product, error: pErr } = await this.admin
      .from('products')
      .insert({
        store_id: store.id, name: `E2E Tee ${this.runId}-${n}`, slug: `${this.tag}-tee-${n}`,
        base_price: price, discounted_price: discounted, is_active: true, is_deleted: false,
      })
      .select('id').single();
    if (pErr) throw new Error(`product: ${pErr.message}`);
    this.created.products.push(product.id);

    const { data: color, error: cErr } = await this.admin
      .from('product_colors')
      .insert({ product_id: product.id, color_name: 'Test Black', color_hex: '#000000', sort_order: 1 })
      .select('id').single();
    if (cErr) throw new Error(`color: ${cErr.message}`);
    this.created.colors.push(color.id);

    const { data: variant, error: vErr } = await this.admin
      .from('product_variants')
      // sku is UNIQUE NOT NULL — namespaced like everything else so a crashed
      // run cannot collide with the next one.
      .insert({
        product_id: product.id, color_id: color.id, size: 'M',
        sku: `${this.tag}-${n}-M`,
        stock_qty: stock, reserved_qty: 0, is_available: true,
      })
      .select('id, stock_qty, reserved_qty, available_qty').single();
    if (vErr) throw new Error(`variant: ${vErr.message}`);
    this.created.variants.push(variant.id);

    return { id: store.id, productId: product.id, colorId: color.id, variantId: variant.id, price: discounted ?? price };
  }

  /** A store manager who can call store_confirm_order for the given store. */
  async createStoreManager(storeId) {
    const mgr = await this.createCustomer('mgr');
    await this.admin.from('users').update({ role: 'store_manager' }).eq('id', mgr.id);
    const { data, error } = await this.admin
      .from('store_managers')
      .insert({ user_id: mgr.id, store_id: storeId, is_active: true })
      .select('id').single();
    if (error) throw new Error(`store_manager: ${error.message}`);
    this.created.storeManagers.push(data.id);
    // The session predates the role change, so its JWT claims are stale.
    await mgr.client.auth.refreshSession();
    return mgr;
  }

  /** A verified, available rider. */
  async createRider() {
    const rider = await this.createCustomer('rider');
    await this.admin.from('users').update({ role: 'rider' }).eq('id', rider.id);
    // 015 auto-provisions a riders row on signup; verify it rather than insert.
    const { data: existing } = await this.admin.from('riders').select('id').eq('user_id', rider.id).maybeSingle();
    let riderId = existing?.id;
    if (!riderId) {
      const { data, error } = await this.admin
        .from('riders').insert({ user_id: rider.id, is_verified: true, is_available: true })
        .select('id').single();
      if (error) throw new Error(`rider: ${error.message}`);
      riderId = data.id;
      this.created.riders.push(riderId);
    } else {
      await this.admin.from('riders').update({ is_verified: true, is_available: true }).eq('id', riderId);
    }
    await rider.client.auth.refreshSession();
    return { ...rider, riderId };
  }

  trackOrder(orderId) {
    if (orderId) this.created.orders.push(orderId);
  }

  /**
   * Remove everything, most-dependent first. Every delete is best-effort and
   * reported, because a teardown that aborts on the first error leaves MORE
   * residue than one that keeps going — and residue in `payments` is exactly
   * what makes `pending_fee_refunds()` untrustworthy.
   */
  async teardown() {
    const steps = [
      ['payments', () => this.admin.from('payments').delete().in('order_id', this.created.orders)],
      ['returns', () => this.admin.from('returns').delete().in('order_id', this.created.orders)],
      ['try_sessions', () => this.admin.from('try_sessions').delete().in('order_id', this.created.orders)],
      ['deliveries', () => this.admin.from('deliveries').delete().in('order_id', this.created.orders)],
      ['order_items', () => this.admin.from('order_items').delete().in('order_id', this.created.orders)],
      ['orders', () => this.admin.from('orders').delete().in('id', this.created.orders)],
      ['notifications', () => this.admin.from('notifications').delete().in('user_id', this.created.users)],
      ['complaints', () => this.admin.from('complaints').delete().in('user_id', this.created.users)],
      ['addresses', () => this.admin.from('addresses').delete().in('id', this.created.addresses)],
      ['store_managers', () => this.admin.from('store_managers').delete().in('id', this.created.storeManagers)],
      ['product_variants', () => this.admin.from('product_variants').delete().in('id', this.created.variants)],
      ['product_colors', () => this.admin.from('product_colors').delete().in('id', this.created.colors)],
      ['products', () => this.admin.from('products').delete().in('id', this.created.products)],
      ['stores', () => this.admin.from('stores').delete().in('id', this.created.stores)],
      ['riders', () => this.admin.from('riders').delete().in('id', this.created.riders)],
      ['activity_logs', () => this.admin.from('activity_logs').delete().in('admin_id', this.created.users)],
      ['users', () => this.admin.from('users').delete().in('id', this.created.users)],
    ];

    const problems = [];
    for (const [name, run] of steps) {
      const ids = name === 'notifications' || name === 'users' ? this.created.users : null;
      if (ids && ids.length === 0) continue;
      const { error } = await run();
      if (error) problems.push(`${name}: ${error.message}`);
    }
    for (const id of this.created.authUsers) {
      const { error } = await this.admin.auth.admin.deleteUser(id);
      if (error) problems.push(`auth.users(${id}): ${error.message}`);
    }
    return problems;
  }
}

/**
 * Delete leftovers from runs that died before teardown. Matched on the `e2e-`
 * naming convention, never on "recently created" — the difference between a
 * sweep you can run without thinking and one that eats real data.
 */
export async function sweep(env, report) {
  const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });

  const { data: users } = await admin.from('users').select('id, email').like('email', 'e2e-%@fitxo.test');
  const userIds = (users ?? []).map((u) => u.id);
  const { data: stores } = await admin.from('stores').select('id').like('slug', 'e2e-%');
  const storeIds = (stores ?? []).map((s) => s.id);

  report.info(`sweep found ${userIds.length} test user(s), ${storeIds.length} test store(s)`);
  if (userIds.length === 0 && storeIds.length === 0) return 0;

  const { data: orders } = await admin.from('orders').select('id').in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: products } = await admin.from('products').select('id').in('store_id', storeIds.length ? storeIds : ['00000000-0000-0000-0000-000000000000']);
  const productIds = (products ?? []).map((p) => p.id);

  const safe = (arr) => (arr.length ? arr : ['00000000-0000-0000-0000-000000000000']);
  await admin.from('payments').delete().in('order_id', safe(orderIds));
  await admin.from('returns').delete().in('order_id', safe(orderIds));
  await admin.from('try_sessions').delete().in('order_id', safe(orderIds));
  await admin.from('deliveries').delete().in('order_id', safe(orderIds));
  await admin.from('order_items').delete().in('order_id', safe(orderIds));
  await admin.from('orders').delete().in('id', safe(orderIds));
  await admin.from('notifications').delete().in('user_id', safe(userIds));
  await admin.from('addresses').delete().in('user_id', safe(userIds));
  await admin.from('store_managers').delete().in('store_id', safe(storeIds));
  await admin.from('product_variants').delete().in('product_id', safe(productIds));
  await admin.from('product_colors').delete().in('product_id', safe(productIds));
  await admin.from('products').delete().in('id', safe(productIds));
  await admin.from('stores').delete().in('id', safe(storeIds));
  await admin.from('riders').delete().in('user_id', safe(userIds));
  await admin.from('users').delete().in('id', safe(userIds));
  for (const id of userIds) await admin.auth.admin.deleteUser(id);

  return userIds.length + storeIds.length;
}
