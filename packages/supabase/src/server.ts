import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// See client.ts — a distinct cookie name per app so the panels don't share one
// auth cookie (which on localhost collides across ports and breaks navigation).
const cookieName = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_NAME;

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    }
  );
}
