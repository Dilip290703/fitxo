import { createClient } from '@fitzo/supabase/server';
import { emailAllowed, getMfaGate } from './mfa';

/**
 * Server-action gate: resolves the caller from the RLS-bound SSR session and
 * verifies their profile role is `admin`, their email is on the allowlist
 * (when configured), and the session has passed MFA (W3.5). Every server
 * action that touches the service-role client MUST call this first —
 * middleware alone doesn't protect a directly-invoked action endpoint.
 *
 * Returns the acting admin's user id (for activity logging).
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Admin access required');

  if (!emailAllowed(user.email)) {
    throw new Error('This account is not on the admin allowlist');
  }

  const gate = await getMfaGate(supabase);
  if (gate !== 'ok') {
    throw new Error('Two-factor authentication required — sign in again');
  }

  return user.id;
}
