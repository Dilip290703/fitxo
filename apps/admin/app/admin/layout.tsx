import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@fitzo/supabase/server';
import { emailAllowed, getMfaGate } from '@/lib/mfa';
import AdminShell from '@/components/admin/AdminShell';
import { ToastProvider } from '@/components/admin/Toast';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Skip auth entirely for the login page — middleware already handles it
  const headersList = await headers();
  if (headersList.get('x-admin-is-login') === '1') {
    return <>{children}</>;
  }

  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) redirect('/admin/login');

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    redirect('/admin/login');
  }

  // W3.5: allowlist + MFA. A denied account is routed to login with a marker
  // so the page signs it out (prevents redirect loops); an aal1 session with
  // a verified factor (or unenrolled while enforcement is on) goes back to
  // login, which jumps straight to the verify/enroll step.
  if (!emailAllowed(profile.email ?? authUser.email)) {
    redirect('/admin/login?denied=allowlist');
  }
  const gate = await getMfaGate(supabase);
  if (gate !== 'ok') {
    redirect('/admin/login');
  }

  return (
    <ToastProvider>
      <AdminShell userName={profile.name ?? profile.email ?? 'Admin'}>{children}</AdminShell>
    </ToastProvider>
  );
}
