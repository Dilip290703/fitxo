import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Project refs this suite is ALLOWED to write to.
 *
 * This is an allowlist, not a prod blocklist, and the difference is the whole
 * point: a blocklist fails open. A new staging project, a restored snapshot, a
 * typo'd ref — all of those would sail past "is it prod?" and get a suite that
 * creates users and orders and then deletes them. Anything not named here has
 * to be named here.
 */
const WRITABLE_REFS = new Set(['zqmggvuizjkxbrxlblzp']); // dev only

/** Known production. Named separately so the error can say so out loud. */
const PROD_REFS = new Set(['bozqclrtbxkjevgztruc']);

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

export function refOf(url) {
  return new URL(url).hostname.split('.')[0];
}

/**
 * Resolve credentials. Real process env wins, so CI can inject them; otherwise
 * fall back to the local .env.local files, which is what makes this runnable
 * with no setup on a developer machine.
 */
export function loadEnv() {
  const customer = parseEnvFile(resolve(REPO_ROOT, 'apps/customer/.env.local'));
  const admin = parseEnvFile(resolve(REPO_ROOT, 'apps/admin/.env.local'));

  const url = process.env.E2E_SUPABASE_URL || customer.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.E2E_SUPABASE_ANON_KEY || customer.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.E2E_SERVICE_ROLE_KEY || admin.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [
    !url && 'SUPABASE_URL (apps/customer/.env.local → NEXT_PUBLIC_SUPABASE_URL)',
    !anonKey && 'ANON_KEY (apps/customer/.env.local → NEXT_PUBLIC_SUPABASE_ANON_KEY)',
    !serviceKey && 'SERVICE_ROLE_KEY (apps/admin/.env.local → SUPABASE_SERVICE_ROLE_KEY)',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Missing credentials:\n  - ${missing.join('\n  - ')}`);
  }

  return { url, anonKey, serviceKey, ref: refOf(url) };
}

/**
 * @param {boolean} willWrite  false for --preflight, which only reads.
 */
export function assertTargetIsSafe(env, willWrite) {
  if (!willWrite) return;

  if (PROD_REFS.has(env.ref)) {
    throw new Error(
      `REFUSING TO RUN: ${env.ref} is PRODUCTION.\n` +
      `This suite creates users, orders and payment rows. There is no flag to override this.\n` +
      `To check prod, use --preflight, which never writes.`,
    );
  }
  if (!WRITABLE_REFS.has(env.ref)) {
    throw new Error(
      `REFUSING TO RUN: ${env.ref} is not a known-writable project.\n` +
      `Writable: ${[...WRITABLE_REFS].join(', ')}\n` +
      `If this really is a throwaway environment, add its ref to WRITABLE_REFS in scripts/e2e/lib/env.mjs.`,
    );
  }
}
