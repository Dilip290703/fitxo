import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Admin MFA + allowlist (launch plan W3.5 / D1).
 *
 * Rollout order (verified live on dev, 2026-07-16) — TOTP must be enabled in
 * the dashboard BEFORE the flag, or enroll() fails and login dead-ends:
 *   1. Supabase dashboard → Authentication → MFA → enable TOTP (per project)
 *   2. set NEXT_PUBLIC_ADMIN_REQUIRE_MFA=true for that environment
 *   3. each admin signs in → the login page walks them through QR enrollment
 *      automatically (the enroll step IS the safety net — nobody is locked out
 *      by flipping the flag, as long as step 1 is done first)
 *
 * Enrollment is sticky: once an admin HAS a verified factor they must always
 * pass the 6-digit check, even if the flag is later turned off — a session
 * that can be upgraded to aal2 is never accepted at aal1.
 */
export function mfaRequired(): boolean {
  return process.env.NEXT_PUBLIC_ADMIN_REQUIRE_MFA === 'true';
}

/**
 * Server-only allowlist (ADMIN_EMAIL_ALLOWLIST, comma-separated,
 * case-insensitive). Unset/empty = any admin-role account (backwards
 * compatible). Enforced in the layout (UX redirect) and requireAdmin (hard,
 * every service-role action) — deliberately NOT in middleware, so a denied
 * session lands on the login page where it is signed out instead of looping.
 */
export function emailAllowed(email: string | null | undefined): boolean {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST;
  if (!raw || raw.trim() === '') return true;
  if (!email) return false;
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export type MfaGate = 'ok' | 'verify' | 'enroll';

/**
 * Where does this session stand? Network-free: reads the JWT's aal claim +
 * the session's factor list via getAuthenticatorAssuranceLevel.
 *   'verify' — has a verified TOTP factor but the session is only aal1
 *   'enroll' — no factor yet and enforcement is on
 *   'ok'     — aal2, or MFA not applicable
 */
export async function getMfaGate(supabase: SupabaseClient): Promise<MfaGate> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!data) return 'ok'; // no session — the auth gates handle that
  if (data.currentLevel === 'aal2') return 'ok';
  if (data.nextLevel === 'aal2') return 'verify';
  return mfaRequired() ? 'enroll' : 'ok';
}
