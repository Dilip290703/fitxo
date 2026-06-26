import { createBrowserClient } from '@supabase/ssr';

// Each app sets NEXT_PUBLIC_SUPABASE_COOKIE_NAME (in its next.config.ts) to a
// distinct value so the four panels don't share one auth cookie. On localhost
// cookies are shared across ports, so without this a session in one panel
// (e.g. the rider) clobbers another (e.g. admin), bouncing you back to login.
const cookieName = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_NAME;

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    cookieName ? { cookieOptions: { name: cookieName } } : undefined
  );
}
