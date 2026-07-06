import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const cookieName = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_NAME;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // A logged-in user is only "an admin" if their profile role is exactly
  // `admin`. On localhost the Supabase session cookie is shared across ports,
  // so a customer/rider session from :3000/:3002 leaks into the admin app —
  // without this role check the login page bounces them to /admin and the
  // layout bounces them back, causing an infinite redirect loop.
  // `store_manager` is deliberately NOT accepted: store signup is public
  // self-serve, so admitting it would open this panel to the internet.
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    isAdmin = profile?.role === 'admin';
  }

  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') {
      if (isAdmin) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      // Not an admin (or not signed in) → let the login form render.
      // Pass a header so the layout knows this is the login page and skips auth.
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-admin-is-login', '1');
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/admin/:path*'],
};
