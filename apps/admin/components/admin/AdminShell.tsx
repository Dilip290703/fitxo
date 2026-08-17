'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@fitxo/supabase/client';
import OrderAlerts from '@/components/admin/OrderAlerts';
import GlobalSearch from '@/components/admin/GlobalSearch';
import { Icon, type IconName } from '@/components/admin/icons';

type NavItem = { label: string; icon: IconName; href: string };
type NavSection = { label: string | null; items: NavItem[] };

// Grouped by job-to-be-done: daily operations first, money next, system last.
// CMS is parked (route still exists, no consumer yet) — deliberately not here.
const NAV: NavSection[] = [
  {
    label: null,
    items: [{ label: 'Dashboard', icon: 'dashboard', href: '/admin' }],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Orders', icon: 'orders', href: '/admin/orders' },
      { label: 'Deliveries', icon: 'deliveries', href: '/admin/deliveries' },
      { label: 'Complaints', icon: 'complaints', href: '/admin/complaints' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Customers', icon: 'customers', href: '/admin/customers' },
      { label: 'Stores', icon: 'stores', href: '/admin/stores' },
      { label: 'Riders', icon: 'riders', href: '/admin/riders' },
    ],
  },
  {
    label: 'Money',
    items: [
      { label: 'Revenue', icon: 'revenue', href: '/admin/analytics' },
      { label: 'Finance (P&L)', icon: 'revenue', href: '/admin/finance' },
      { label: 'Payments', icon: 'payments', href: '/admin/payments' },
      { label: 'Store Payouts', icon: 'payouts', href: '/admin/payouts' },
      { label: 'Agent Payouts', icon: 'payouts', href: '/admin/agent-payouts' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Inventory', icon: 'inventory', href: '/admin/inventory' },
      { label: 'Brands & Categories', icon: 'taxonomy', href: '/admin/taxonomy' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { label: 'Promo Codes', icon: 'promos', href: '/admin/coupons' },
      { label: 'Notifications', icon: 'notifications', href: '/admin/notifications' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', icon: 'settings', href: '/admin/settings' },
      { label: 'User Roles', icon: 'roles', href: '/admin/users' },
      { label: 'Reports', icon: 'reports', href: '/admin/reports' },
      { label: 'Activity Log', icon: 'activity', href: '/admin/activity' },
    ],
  },
];

const COLLAPSE_KEY = 'fitxo-admin-nav-collapsed';

function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

function sectionTitle(pathname: string): string {
  for (const section of NAV) {
    const hit = section.items.find((i) => isActive(pathname, i.href));
    if (hit) return hit.label;
  }
  if (pathname.startsWith('/admin/content')) return 'Content (parked)';
  return 'Admin';
}

/**
 * The persistent panel chrome: grouped sidebar (collapsible), header with
 * page title + global jump-to search + live order alerts. Denser than the
 * Store panel's shell — this is a 2-user ops room, data beats whitespace.
 */
export default function AdminShell({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  const sidebar = (showLabels: boolean) => (
    <div className="flex h-full flex-col bg-ink text-white">
      {/* Brand */}
      <div className={`border-b border-white/10 py-3.5 ${showLabels ? 'px-4' : 'px-2'}`}>
        <Link href="/admin" className={`flex items-center gap-2 ${showLabels ? '' : 'justify-center'}`}>
          <span className="font-serif text-[16px] font-semibold tracking-[0.18em]">
            {showLabels ? 'FITXO' : 'F'}
          </span>
          {showLabels ? (
            <span className="rounded-full border border-white/25 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75">
              Admin
            </span>
          ) : null}
        </Link>
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-2 ${showLabels ? 'px-2.5' : 'px-2'}`}>
        {NAV.map((section) => (
          <div key={section.label ?? 'top'}>
            {section.label && showLabels ? (
              <p className="mb-0.5 mt-3 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                {section.label}
              </p>
            ) : section.label ? (
              <div className="mx-2 my-2 border-t border-white/10" />
            ) : null}
            <div className="space-y-px">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={showLabels ? undefined : item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg py-[7px] text-[12.5px] font-medium transition ${
                      showLabels ? 'px-2.5' : 'justify-center px-0'
                    } ${active ? 'bg-accent text-ink' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                  >
                    <Icon name={item.icon} className="h-4 w-4" />
                    {showLabels ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: user + logout + collapse */}
      <div className={`border-t border-white/10 py-2 ${showLabels ? 'px-2.5' : 'px-2'}`}>
        {showLabels ? (
          <p className="truncate px-2.5 py-1 text-[11px] text-white/40" title={userName}>
            {userName}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          title="Log out"
          className={`flex w-full items-center gap-2.5 rounded-lg py-[7px] text-[12.5px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white ${
            showLabels ? 'px-2.5' : 'justify-center px-0'
          }`}
        >
          <Icon name="logout" className="h-4 w-4" />
          {showLabels ? 'Log out' : null}
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`hidden w-full items-center gap-2.5 rounded-lg py-[7px] text-[12.5px] font-medium text-white/50 transition hover:bg-white/10 hover:text-white lg:flex ${
            showLabels ? 'px-2.5' : 'justify-center px-0'
          }`}
        >
          <Icon name="collapse" className={`h-4 w-4 transition ${collapsed ? 'rotate-180' : ''}`} />
          {showLabels ? 'Collapse' : null}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block ${
          collapsed ? 'w-[60px]' : 'w-[216px]'
        }`}
      >
        {sidebar(!collapsed)}
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[240px]">{sidebar(true)}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink lg:hidden"
          >
            <Icon name="menu" className="h-4 w-4" />
          </button>
          <h1 className="hidden min-w-0 shrink-0 truncate text-[13.5px] font-semibold text-ink sm:block sm:w-[150px]">
            {sectionTitle(pathname)}
          </h1>
          <div className="flex min-w-0 flex-1 justify-center">
            <GlobalSearch />
          </div>
          <OrderAlerts />
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
