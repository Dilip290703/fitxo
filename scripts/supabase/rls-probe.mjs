#!/usr/bin/env node
/**
 * RLS probe suite (launch plan W4.1 / D3).
 *
 * WHY: on 2026-06-08 RLS was found DISABLED on users/orders/order_items in the
 * live DB — the policies in schema.sql were intact, the switch was just off, so
 * anyone with the (public) anon key could read every customer's name, email,
 * phone and order. Nothing caught it; it was noticed by accident. This script
 * is the automated guard.
 *
 * HOW: it probes over the REST API with the ANON key — the real attack surface
 * — rather than reading a config flag. No DB password needed, so it runs in CI
 * with values that are already public.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_ANON_KEY=<anon key> \
 *   [SUPABASE_SERVICE_ROLE_KEY=<service key>] \
 *   node scripts/supabase/rls-probe.mjs
 *
 * The service-role key is OPTIONAL but recommended: without it, a table that
 * is merely EMPTY is indistinguishable from one properly protected by RLS, so
 * the probe reports those as inconclusive rather than claiming a pass. With
 * it, the probe proves "N rows exist, anon sees 0" — actual evidence.
 *
 * Exit 0 = safe, exit 1 = a leak (or a storefront table that broke).
 */

const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !ANON) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_ANON_KEY are required.');
  process.exit(2);
}

/** Anon must NEVER see a row here. A single row back = leak = CI red. */
const SENSITIVE = [
  'users',                  // the 2026-06-08 incident: names, emails, phones
  'orders',                 // ditto
  'order_items',            // ditto
  'addresses',              // home addresses
  'payments',
  'payouts',
  'agent_payouts',
  'try_sessions',
  'returns',
  'deliveries',             // drop addresses + phone
  'riders',
  'store_managers',
  'store_business_details',  // KYC: PAN, GST, bank account
  'rider_payout_details',    // bank/UPI + PAN
  'complaints',
  'activity_logs',
  'notifications',
  'system_settings',         // commission/fee config — authenticated-read only
  'delivery_declines',
];

/** The storefront. Anon SHOULD read these — over-locking is a bug too. */
const PUBLIC_OK = [
  'products',
  'stores',
  'brands',
  'categories',
  'product_variants',
  'product_colors',
  'product_images',
  'content_blocks',   // only is_published rows; empty today
];

/**
 * Documented, accepted-for-now exposures. Printed loudly as WARN so they can't
 * rot silently, but they don't fail CI. Remove the entry when fixed — that IS
 * the fix's acceptance test.
 */
const KNOWN_EXCEPTIONS = [
  {
    table: 'coupons',
    why: 'schema.sql coupons_select = "is_active = true OR is_admin()" → every active promo code is publicly enumerable (incl. limited-use ones). Fix belongs with W3.2 lean coupons: validate a submitted code via an RPC instead of exposing the table.',
  },
];

async function probe(table, key) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
    },
  });
  // content-range is "0-0/12" or "*/0" — the total is after the slash.
  const range = res.headers.get('content-range');
  const total = range ? Number(range.split('/')[1]) : null;
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body — leave null */
  }
  // A PostgREST error is an OBJECT with a `code` field. Note: a successful
  // response is an ARRAY, and rows may themselves contain a "code" column
  // (coupons do) — so check the shape, never grep the text.
  const error = !Array.isArray(body) && body && typeof body === 'object' && body.code ? body : null;
  return { ok: res.ok, status: res.status, total, error };
}

const failures = [];
const inconclusive = [];

console.log(`RLS probe → ${URL_BASE}`);
console.log(`service-role cross-check: ${SERVICE ? 'on (results are evidence)' : 'OFF (empty tables are inconclusive)'}\n`);

console.log('── Sensitive tables (anon must see nothing) ──');
for (const table of SENSITIVE) {
  const anon = await probe(table, ANON);

  // An error here is fine — permission denied is a *stronger* pass than 0 rows.
  if (anon.error) {
    console.log(`  ✅ ${table.padEnd(24)} anon blocked (${anon.error.code})`);
    continue;
  }
  if (anon.total === null) {
    console.log(`  ⚠️  ${table.padEnd(24)} no count header — skipped`);
    continue;
  }
  if (anon.total > 0) {
    console.log(`  ❌ ${table.padEnd(24)} LEAK — anon can read ${anon.total} row(s)`);
    failures.push(`${table}: anon read ${anon.total} row(s)`);
    continue;
  }

  // anon sees 0 — but is the table actually populated?
  if (SERVICE) {
    const real = await probe(table, SERVICE);
    if ((real.total ?? 0) > 0) {
      console.log(`  ✅ ${table.padEnd(24)} ${real.total} row(s) exist, anon sees 0`);
    } else {
      console.log(`  ➖ ${table.padEnd(24)} anon sees 0, but table is empty — inconclusive`);
      inconclusive.push(table);
    }
  } else {
    console.log(`  ➖ ${table.padEnd(24)} anon sees 0 (may just be empty — pass service key for proof)`);
    inconclusive.push(table);
  }
}

console.log('\n── Storefront tables (anon should read these) ──');
for (const table of PUBLIC_OK) {
  const anon = await probe(table, ANON);
  if (anon.error) {
    console.log(`  ❌ ${table.padEnd(24)} BROKEN — anon blocked (${anon.error.code}: ${anon.error.message})`);
    failures.push(`${table}: storefront table not readable by anon (${anon.error.code})`);
  } else {
    console.log(`  ✅ ${table.padEnd(24)} readable (${anon.total ?? '?'} row(s))`);
  }
}

if (KNOWN_EXCEPTIONS.length > 0) {
  console.log('\n── Known exposures (tracked, not failing) ──');
  for (const e of KNOWN_EXCEPTIONS) {
    const anon = await probe(e.table, ANON);
    const visible = !anon.error && (anon.total ?? 0) > 0;
    console.log(`  ${visible ? '⚠️ ' : '✅'} ${e.table.padEnd(24)} ${visible ? `anon reads ${anon.total} row(s)` : 'no longer exposed — remove this exception'}`);
    if (visible) console.log(`      ${e.why}`);
  }
}

console.log('');
if (failures.length > 0) {
  console.log(`❌ ${failures.length} FAILURE(S) — this is the 2026-06-08 incident class:`);
  for (const f of failures) console.log(`   • ${f}`);
  console.log('\nCheck RLS is enabled on every public table:');
  console.log("   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';");
  console.log('Re-enable with packages/supabase/migrations/005_reenable_rls.sql (idempotent).');
  process.exit(1);
}

console.log('✅ No leaks.');
if (inconclusive.length > 0) {
  console.log(`   (${inconclusive.length} table(s) inconclusive — empty, or no service key supplied.)`);
}
process.exit(0);
