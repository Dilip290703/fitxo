#!/usr/bin/env node
/**
 * Razorpay key-sync check (launch plan W4.9 / C4).
 *
 * WHY: the Razorpay key secret lives in four places that must move together —
 * apps/customer/.env.local, apps/admin/.env.local, and the Supabase Vault
 * (`razorpay_key_secret`) on BOTH dev and prod. The app calls Razorpay's API
 * with it; the database re-verifies Razorpay's HMAC in-DB with it
 * (confirm_keep_payment / razorpay_webhook_captured), so a client can't forge
 * a settlement.
 *
 * That split makes a half-finished rotation fail silently in the worst way:
 * the app charges with the NEW key, Razorpay signs with the NEW secret, the
 * database checks against the OLD one — money moves, the order never settles,
 * and the only trace is 'invalid payment signature' in a log. This script
 * turns that into a two-second check.
 *
 * HOW: it never compares secrets directly. Each location is reduced to an
 * HMAC fingerprint of a fixed probe string — the same digest migration 057's
 * razorpay_secret_fingerprints() computes inside Postgres — and only the
 * fingerprints are compared. No secret is printed, logged, or sent anywhere.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service key> \
 *   node scripts/razorpay/check-key-sync.mjs
 *
 * Env vars are read from apps/{customer,admin}/.env.local automatically.
 * Point SUPABASE_URL at dev, then at prod — the Vault half is per-project.
 *
 * Exit 0 = every copy agrees, exit 1 = a mismatch, exit 2 = bad usage.
 */

import { createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Must match migration 057's probe string exactly, or nothing will ever agree.
const PROBE = 'fitzo-rotation-check';

const fingerprint = (secret) =>
  createHmac('sha256', secret).update(PROBE).digest('hex');

/** Minimal .env parser — no dependency, and it must not choke on quotes or #. */
function readEnv(path) {
  if (!existsSync(path)) return null;
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim().replace(/\s+#.*$/, '');
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const customer = readEnv(join(REPO, 'apps/customer/.env.local'));
const admin = readEnv(join(REPO, 'apps/admin/.env.local'));

let failures = 0;
const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m) => { console.log(`  ❌ ${m}`); failures++; };
const skip = (m) => console.log(`  ⚠️  ${m}`);

console.log('== 1. Key secret matches across the two app envs ==');
const cSecret = customer?.RAZORPAY_KEY_SECRET;
const aSecret = admin?.RAZORPAY_KEY_SECRET;

if (!customer) skip('apps/customer/.env.local not found — skipped');
else if (!cSecret) bad('apps/customer/.env.local has no RAZORPAY_KEY_SECRET');
if (!admin) skip('apps/admin/.env.local not found — skipped');
else if (!aSecret) bad('apps/admin/.env.local has no RAZORPAY_KEY_SECRET');

let envFp = null;
if (cSecret && aSecret) {
  if (fingerprint(cSecret) === fingerprint(aSecret)) {
    envFp = fingerprint(cSecret);
    ok('customer and admin carry the SAME key secret');
  } else {
    bad('customer and admin carry DIFFERENT key secrets — refunds or checkout will break');
  }
} else if (cSecret || aSecret) {
  envFp = fingerprint(cSecret || aSecret);
  skip('only one app env has a key secret — cannot cross-check the pair');
}

// The key ID is regenerated ALONGSIDE the secret; a stale ID is the other half
// of a partial rotation and is just as broken.
console.log('== 2. Key ID matches across the two app envs ==');
const cId = customer?.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const aId = admin?.RAZORPAY_KEY_ID;
if (cId && aId) {
  if (cId === aId) ok(`both apps use the same key id (${cId.slice(0, 9)}…)`);
  else bad('customer and admin point at DIFFERENT Razorpay key ids');
} else {
  skip('key id missing in one or both app envs — cannot cross-check');
}

console.log('== 3. Vault copies match the apps (per project) ==');
// Default to the admin app's own env: it is the one app that legitimately holds
// a service-role key, and it is already parsed above — so the common case (dev)
// needs no arguments. Explicit env vars override, which is how prod is checked.
const URL_BASE = (process.env.SUPABASE_URL || admin?.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || admin?.SUPABASE_SERVICE_ROLE_KEY;
let vaultChecked = false;

if (!URL_BASE || !SERVICE) {
  skip('no Supabase URL / service-role key — Vault half skipped');
  skip('set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or fill apps/admin/.env.local');
} else {
  vaultChecked = true;
  // Always say WHICH project was checked — "it passed" is meaningless without it,
  // and dev vs prod is a single env var apart.
  const ref = URL_BASE.match(/https?:\/\/([^.]+)\./)?.[1] ?? URL_BASE;
  console.log(`  › project: ${ref}`);
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/razorpay_secret_fingerprints`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!res.ok) {
    const body = await res.text();
    bad(`could not read Vault fingerprints (HTTP ${res.status}) — is migration 057 applied? ${body.slice(0, 160)}`);
  } else {
    const rows = await res.json();
    const keyRow = rows.find((r) => r.secret_name === 'razorpay_key_secret');
    const hookRow = rows.find((r) => r.secret_name === 'razorpay_webhook_secret');

    if (!keyRow?.configured) {
      bad('Vault has no razorpay_key_secret — in-DB signature verification will reject every payment');
    } else if (!envFp) {
      skip('no app-side secret to compare the Vault against');
    } else if (keyRow.fingerprint === envFp) {
      ok('Vault razorpay_key_secret MATCHES the app envs');
    } else {
      bad('Vault razorpay_key_secret DIFFERS from the app envs — payments will charge but never settle');
    }

    // The webhook secret is a SEPARATE credential: regenerating API keys does
    // not change it, and rotating it means re-saving it in the Razorpay
    // dashboard's webhook config too.
    const hookEnv = customer?.RAZORPAY_WEBHOOK_SECRET;
    if (!hookRow?.configured) {
      bad('Vault has no razorpay_webhook_secret — payment.captured webhooks (039/043) will fail');
    } else if (!hookEnv) {
      skip('apps/customer/.env.local has no RAZORPAY_WEBHOOK_SECRET to compare');
    } else if (hookRow.fingerprint === fingerprint(hookEnv)) {
      ok('Vault razorpay_webhook_secret MATCHES apps/customer');
    } else {
      bad('Vault razorpay_webhook_secret DIFFERS from apps/customer — webhooks will 401');
    }

    // Found live on dev, 2026-07-25: Vault's webhook secret was a copy of the
    // API KEY secret — pasted from the wrong field in the Razorpay dashboard.
    // The route verifies against the env value and passes, then the in-DB
    // re-verification (039) rejects it, so payment.captured never settles and
    // the "phone died right after paying" recovery path silently does nothing.
    // Two distinct credentials can never legitimately be equal, so say so by
    // name rather than leaving it as a bare "DIFFERS".
    if (keyRow?.configured && hookRow?.configured && keyRow.fingerprint === hookRow.fingerprint) {
      bad(
        'Vault razorpay_webhook_secret is the SAME value as razorpay_key_secret — ' +
          'almost certainly pasted from the wrong dashboard field. The webhook secret comes from ' +
          'Razorpay → Settings → Webhooks (the endpoint\'s own secret), NOT Settings → API Keys. ' +
          'Fix: vault.update_secret((SELECT id FROM vault.secrets WHERE name = \'razorpay_webhook_secret\'), \'<webhook secret>\')',
      );
    }
  }
}

console.log();
if (failures > 0) {
  console.log(`❌ ${failures} problem(s). See docs/ENVIRONMENTS.md → "Rotating the Razorpay keys".`);
  process.exit(1);
}

// A skipped Vault check must NEVER read as a pass. The Vault half is the one
// that decides whether payments actually settle, so "the app envs agree" on its
// own proves nothing about a rotation — and a green tick here before the W5.2
// live cutover would be actively misleading.
if (!vaultChecked) {
  console.log('⚠️  INCOMPLETE — the app envs agree, but the Vault half did NOT run.');
  console.log('   A rotation is NOT verified until the Vault copy is compared, on EACH project:');
  console.log('     dev : pnpm razorpay:check            (reads apps/admin/.env.local)');
  console.log('     prod: SUPABASE_URL=https://<prod-ref>.supabase.co \\');
  console.log('           SUPABASE_SERVICE_ROLE_KEY=<prod service key> pnpm razorpay:check');
  process.exit(2);
}

console.log('✅ Every copy of the Razorpay secrets agrees, including Vault.');
