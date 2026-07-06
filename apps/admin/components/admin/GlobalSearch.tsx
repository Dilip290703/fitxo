'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';
import { Icon } from '@/components/admin/icons';

type Hit = {
  kind: 'order' | 'customer' | 'rider' | 'user' | 'store';
  id: string;
  title: string;
  sub: string;
  href: string;
};

const KIND_LABEL: Record<Hit['kind'], string> = {
  order: 'Order',
  customer: 'Customer',
  rider: 'Rider',
  user: 'User',
  store: 'Store',
};

/**
 * Header jump-to search: order # / customer name / phone / email / store name.
 * ⌘K (or Ctrl+K, or "/") focuses it; Enter opens the highlighted result.
 * Queries run on the RLS-bound anon client — admin policies scope them.
 */
export default function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);

  // Keyboard: ⌘K / Ctrl+K / bare "/" focuses the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement as HTMLElement | null)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/' && !inField) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const search = useCallback(async (term: string) => {
    const supabase = createClient();
    const like = `%${term}%`;

    const [orders, users, stores] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, status, final_amount')
        .ilike('order_number', like)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('users')
        .select('id, name, email, phone, role')
        .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
        .limit(5),
      supabase.from('stores').select('id, name, city').ilike('name', like).limit(4),
    ]);

    const results: Hit[] = [];
    for (const o of orders.data ?? []) {
      results.push({
        kind: 'order',
        id: o.id,
        title: o.order_number,
        sub: `${String(o.status).replace(/_/g, ' ')} · ₹${new Intl.NumberFormat('en-IN').format(o.final_amount ?? 0)}`,
        href: `/admin/orders/${o.id}`,
      });
    }
    // Riders link to their rider profile; everyone else to the customer page /
    // user-roles list.
    const riderUserIds = (users.data ?? []).filter((u) => u.role === 'rider').map((u) => u.id);
    const riderMap = new Map<string, string>();
    if (riderUserIds.length > 0) {
      const { data: riders } = await supabase.from('riders').select('id, user_id').in('user_id', riderUserIds);
      for (const r of riders ?? []) riderMap.set(r.user_id, r.id);
    }
    for (const u of users.data ?? []) {
      const kind: Hit['kind'] = u.role === 'customer' ? 'customer' : u.role === 'rider' ? 'rider' : 'user';
      results.push({
        kind,
        id: u.id,
        title: u.name ?? u.email ?? 'User',
        sub: [u.phone, u.email].filter(Boolean).join(' · '),
        href:
          kind === 'customer'
            ? `/admin/customers/${u.id}`
            : kind === 'rider' && riderMap.has(u.id)
              ? `/admin/riders/${riderMap.get(u.id)}`
              : '/admin/users',
      });
    }
    for (const s of stores.data ?? []) {
      results.push({ kind: 'store', id: s.id, title: s.name, sub: s.city ?? 'Store', href: `/admin/stores/${s.id}` });
    }
    return results;
  }, []);

  // Debounced search.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const results = await search(term);
        setHits(results);
        setActive(0);
        setOpen(true);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, search]);

  const go = (hit: Hit) => {
    setOpen(false);
    setQ('');
    router.push(hit.href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (!open || hits.length === 0) {
      if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(hits[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-[420px]">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 focus-within:border-ink">
        <Icon name="search" className="h-[14px] w-[14px] text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onInputKey}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Jump to order #, phone, customer, store…"
          className="w-full bg-transparent text-[13px] text-ink placeholder-faint focus:outline-none"
        />
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-muted sm:block">
          ⌘K
        </kbd>
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-line bg-white shadow-pop">
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-muted">{searching ? 'Searching…' : 'No matches.'}</p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto py-1">
              {hits.map((h, i) => (
                <li key={`${h.kind}-${h.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${
                      i === active ? 'bg-cream' : ''
                    }`}
                  >
                    <span className="w-[64px] shrink-0 rounded-full bg-hairline px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-soft">
                      {KIND_LABEL[h.kind]}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">{h.title}</span>
                      <span className="block truncate text-[11px] text-muted">{h.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
