import { createClient } from '@fitxo/supabase/server';
import StatsCard from '@/components/admin/StatsCard';
import PaymentsClient, { type PaymentRow } from './PaymentsClient';
import {
  parsePageParams,
  rangeFor,
  lastPage,
  readParam,
  sanitizeSearch,
  type RawParams,
} from '@/lib/pagination';

const PAYMENT_SORTABLE = ['created_at', 'amount', 'paid_at'] as const;
const PAYMENT_STATUSES = ['success', 'initiated', 'pending', 'failed', 'refunded'];

/**
 * The "Total Captured" card needs a SUM, and this project's PostgREST has
 * aggregate functions disabled ("Use of aggregate functions is not allowed",
 * verified against dev) — so the sum still reads rows. It reads ONE numeric
 * column for successful payments only, instead of the previous full-row scan
 * of the entire table, and stops here. When payments outgrow this, the fix is
 * an aggregate RPC (next free migration), not a bigger cap.
 */
const SUM_SCAN_LIMIT = 20000;

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const statusParam = readParam(sp, 'status');
  const status = statusParam && PAYMENT_STATUSES.includes(statusParam) ? statusParam : null;
  const q = sanitizeSearch(readParam(sp, 'q'));
  const params = parsePageParams(sp, {
    sortable: PAYMENT_SORTABLE,
    defaultSort: 'created_at',
    defaultDir: 'desc',
  });

  // The searchable fields live on three tables — the payment id is local, the
  // order number is on `orders`, the customer is on `users` — and PostgREST
  // cannot OR across a base column and embedded ones. Resolve the two foreign
  // sides first, then fold them in as id sets.
  let search: string | null = null;
  if (q) {
    const [{ data: matchedOrders }, { data: matchedUsers }] = await Promise.all([
      supabase.from('orders').select('id').ilike('order_number', `%${q}%`).limit(1000),
      supabase.from('users').select('id').or(`name.ilike.%${q}%,email.ilike.%${q}%`).limit(1000),
    ]);
    const clauses = [`razorpay_payment_id.ilike.%${q}%`];
    const orderIds = (matchedOrders ?? []).map((o) => o.id);
    const userIds = (matchedUsers ?? []).map((u) => u.id);
    if (orderIds.length) clauses.push(`order_id.in.(${orderIds.join(',')})`);
    if (userIds.length) clauses.push(`user_id.in.(${userIds.join(',')})`);
    search = clauses.join(',');
  }

  let countQuery = supabase.from('payments').select('id', { count: 'exact', head: true });
  if (status) countQuery = countQuery.eq('status', status);
  if (search) countQuery = countQuery.or(search);
  const { count } = await countQuery;
  const total = count ?? 0;

  const page = Math.min(params.page, lastPage(total, params.pageSize));
  const [from, to] = rangeFor({ ...params, page });

  let rowsQuery = supabase
    .from('payments')
    .select(
      `id, amount, currency, status, payment_method, razorpay_payment_id, razorpay_order_id, paid_at, created_at, order_id,
       orders(order_number),
       users(name, email)`,
    )
    .order(params.sortKey, { ascending: params.sortDir === 'asc' })
    .range(from, to);
  if (status) rowsQuery = rowsQuery.eq('status', status);
  if (search) rowsQuery = rowsQuery.or(search);

  // The three cards describe the WHOLE table, not the current page — they are
  // a financial summary, so a filter must not appear to change how much money
  // was captured.
  const [{ data }, { count: successCount }, { count: failedCount }, { data: amounts }] = await Promise.all([
    rowsQuery,
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'success'),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('payments').select('amount').eq('status', 'success').limit(SUM_SCAN_LIMIT),
  ]);

  const payments = (data ?? []) as unknown as PaymentRow[];

  // gateway_fee queried separately so the page still renders pre-043 (the
  // column select would 42703 the whole query if bundled) — now scoped to the
  // page's ids rather than every payment ever taken.
  if (payments.length > 0) {
    const { data: feeRows } = await supabase
      .from('payments')
      .select('id, gateway_fee')
      .in('id', payments.map((p) => p.id));
    const feeById = new Map((feeRows ?? []).map((r) => [r.id as string, r.gateway_fee as number | null]));
    for (const p of payments) p.gateway_fee = feeById.get(p.id) ?? null;
  }

  const capturedRows = amounts ?? [];
  const captured = capturedRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const capturedIsPartial = capturedRows.length >= SUM_SCAN_LIMIT;

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Payment Records</h2>
        <p className="text-sm text-muted">
          {total} transactions{status || q ? ' matching' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total Captured"
          value={formatINR(captured)}
          subtitle={capturedIsPartial ? `First ${SUM_SCAN_LIMIT} only — needs an aggregate RPC` : 'Successful payments'}
          icon="₹"
          color="green"
        />
        <StatsCard title="Successful" value={successCount ?? 0} icon="✓" color="green" />
        <StatsCard title="Failed" value={failedCount ?? 0} icon="✕" color="red" />
      </div>

      <PaymentsClient
        payments={payments}
        pageInfo={{ page, pageSize: params.pageSize, total, sortKey: params.sortKey, sortDir: params.sortDir }}
        activeStatus={status ?? 'all'}
        activeSearch={q}
      />
    </div>
  );
}
