import { createClient } from '@fitxo/supabase/server';
import FinanceClient, { type EcoRow, type PnlTotals } from './FinanceClient';

// Date-ranged P&L over the order_economics money truth (money plan M5).
// An order's economics are attributed to its PLACEMENT date — same basis as
// the dashboard and analytics — so a Keep or refund landing later moves the
// figures of the order's original day, never invents a new bucket.

export const dynamic = 'force-dynamic';

const ROW_CAP = 1000;

type RangeKey = 'today' | '7d' | '30d' | 'month' | 'all' | 'custom';

function resolveRange(params: { range?: string; from?: string; to?: string }): {
  key: RangeKey;
  fromIso: string | null;
  toIso: string | null; // exclusive
  from?: string;
  to?: string;
} {
  const key = (params.range as RangeKey) ?? '30d';
  const midnight = () => new Date(new Date().setHours(0, 0, 0, 0));
  switch (key) {
    case 'today':
      return { key, fromIso: midnight().toISOString(), toIso: null };
    case '7d':
      return { key, fromIso: new Date(midnight().getTime() - 6 * 86400000).toISOString(), toIso: null };
    case 'month': {
      const d = midnight();
      d.setDate(1);
      return { key, fromIso: d.toISOString(), toIso: null };
    }
    case 'all':
      return { key, fromIso: null, toIso: null };
    case 'custom': {
      // from/to are the picker's YYYY-MM-DD values; to is inclusive, so the
      // query bound is the NEXT midnight (exclusive).
      const from = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? '') ? params.from! : undefined;
      const to = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? '') ? params.to! : undefined;
      const fromIso = from ? new Date(`${from}T00:00:00`).toISOString() : null;
      const toIso = to ? new Date(new Date(`${to}T00:00:00`).getTime() + 86400000).toISOString() : null;
      return { key, fromIso, toIso, from, to };
    }
    case '30d':
    default:
      return { key: '30d', fromIso: new Date(midnight().getTime() - 29 * 86400000).toISOString(), toIso: null };
  }
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = resolveRange(params);
  const supabase = await createClient();

  let query = supabase
    .from('order_economics')
    .select(
      'order_id, order_number, created_at, status, item_count, kept_count, returned_count, ' +
        'captured_total, refunded_total, net_captured, delivery_fee_collected, gateway_cost, ' +
        'gateway_cost_incomplete, kept_paid_gross, kept_unpaid_gross, commission, store_net, ' +
        'rider_cost, margin, store_paid, rider_paid',
    )
    .order('created_at', { ascending: false })
    .limit(ROW_CAP);
  if (range.fromIso) query = query.gte('created_at', range.fromIso);
  if (range.toIso) query = query.lt('created_at', range.toIso);

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as EcoRow[];

  // Sums over the range. Every field is additive by construction (the view
  // rounds per order); margin = commission + fees collected − rider − gateway.
  const totals = rows.reduce<PnlTotals>(
    (t, r) => ({
      orders: t.orders + 1,
      capturedTotal: t.capturedTotal + Number(r.captured_total ?? 0),
      refundedTotal: t.refundedTotal + Number(r.refunded_total ?? 0),
      netCaptured: t.netCaptured + Number(r.net_captured ?? 0),
      keptPaidGross: t.keptPaidGross + Number(r.kept_paid_gross ?? 0),
      keptUnpaidGross: t.keptUnpaidGross + Number(r.kept_unpaid_gross ?? 0),
      commission: t.commission + Number(r.commission ?? 0),
      feesCollected: t.feesCollected + Number(r.delivery_fee_collected ?? 0),
      gatewayCost: t.gatewayCost + Number(r.gateway_cost ?? 0),
      riderCost: t.riderCost + Number(r.rider_cost ?? 0),
      margin: t.margin + Number(r.margin ?? 0),
      storeNet: t.storeNet + Number(r.store_net ?? 0),
      storePaid: t.storePaid + Number(r.store_paid ?? 0),
      riderPaid: t.riderPaid + Number(r.rider_paid ?? 0),
      gatewayIncomplete: t.gatewayIncomplete || r.gateway_cost_incomplete === true,
    }),
    {
      orders: 0,
      capturedTotal: 0,
      refundedTotal: 0,
      netCaptured: 0,
      keptPaidGross: 0,
      keptUnpaidGross: 0,
      commission: 0,
      feesCollected: 0,
      gatewayCost: 0,
      riderCost: 0,
      margin: 0,
      storeNet: 0,
      storePaid: 0,
      riderPaid: 0,
      gatewayIncomplete: false,
    },
  );

  return (
    <FinanceClient
      rows={rows}
      totals={totals}
      rangeKey={range.key}
      customFrom={range.from ?? ''}
      customTo={range.to ?? ''}
      truncated={rows.length === ROW_CAP}
      loadError={error ? error.message : null}
    />
  );
}
