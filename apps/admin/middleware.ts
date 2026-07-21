import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// The admin layout skips its auth/allowlist/MFA gates when it sees this header,
// and ONLY middleware is allowed to set it (on the login route). Next forwards
// the client's own headers to the RSC render, so an inbound copy would let an
// admin-role account that is off the allowlist or still at aal1 read every
// admin page — middleware's role check alone waves them through. Strip it from
// every request before anything forwards it. (W3.5)
const LOGIN_HEADER = 'x-admin-is-login';

export async function middleware(request: NextRequest) {
  // Re-read on every call: `request.cookies.set()` in setAll writes through to
  // request.headers, and a snapshot taken earlier would forward the pre-refresh
  // session cookie to the render.
  const forwardedRequest = () => {
    const headers = new Headers(request.headers);
    headers.delete(LOGIN_HEADER);
    return { headers };
  };

  let supabaseResponse = NextResponse.next({ request: forwardedRequest() });

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
          supabaseResponse = NextResponse.next({ request: forwardedRequest() });
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
      // Always let the login page render — even for a signed-in admin. Since
      // W3.5 (MFA) the layout bounces aal1 sessions HERE for the verify/enroll
      // step, so a middleware redirect back to /admin would loop; the page's
      // own mount routing sends fully-verified admins to the dashboard.
      const { headers } = forwardedRequest();
      headers.set(LOGIN_HEADER, '1');
      return NextResponse.next({ request: { headers } });
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
