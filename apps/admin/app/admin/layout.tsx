import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@fitzo/supabase/server';
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

  return (
    <ToastProvider>
      <AdminShell userName={profile.name ?? profile.email ?? 'Admin'}>{children}</AdminShell>
    </ToastProvider>
  );
}
