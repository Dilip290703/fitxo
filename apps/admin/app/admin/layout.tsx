import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@fitzo/supabase/server';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import { ToastProvider } from '@/components/admin/Toast';
import type { User } from '@fitzo/supabase/types';

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

  if (!profile || (profile.role !== 'admin' && profile.role !== 'store_manager')) {
    redirect('/admin/login');
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
        <AdminSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminHeader user={profile as User} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
