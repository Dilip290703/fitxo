'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: '▦' },
  { href: '/admin/inventory', label: 'Inventory', icon: '📦' },
  { href: '/admin/orders', label: 'Orders', icon: '🛒' },
  { href: '/admin/payments', label: 'Payments', icon: '💳' },
  { href: '/admin/stores', label: 'Stores', icon: '🏪' },
  { href: '/admin/riders', label: 'Riders', icon: '🛵' },
  { href: '/admin/customers', label: 'Customers', icon: '👤' },
  { href: '/admin/brands', label: 'Brands', icon: '🏷️' },
  { href: '/admin/categories', label: 'Categories', icon: '🗂️' },
  { href: '/admin/coupons', label: 'Coupons', icon: '🎟️' },
  { href: '/admin/deliveries', label: 'Deliveries', icon: '🚚' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="text-2xl font-black text-white tracking-tight">Fitzo</span>
          <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-medium">
            Admin
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-800">
        <p className="text-xs text-gray-600 text-center">Fitzo Admin v1.0</p>
      </div>
    </aside>
  );
}
