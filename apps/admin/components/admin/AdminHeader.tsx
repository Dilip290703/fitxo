'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';
import OrderAlerts from '@/components/admin/OrderAlerts';
import type { User } from '@fitzo/supabase/types';

interface AdminHeaderProps {
  user: User;
  title?: string;
}

export default function AdminHeader({ user, title }: AdminHeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <h1 className="text-sm font-semibold text-white">{title ?? 'Admin Panel'}</h1>

      <div className="flex items-center gap-4">
        <OrderAlerts />

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            {user.name?.charAt(0).toUpperCase() ?? 'A'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm text-white font-medium leading-none">{user.name ?? 'Admin'}</p>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">{user.role.replace('_', ' ')}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
