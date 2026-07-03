import { createClient } from '@fitzo/supabase/server';
import StatsCard from '@/components/admin/StatsCard';
import PaymentsClient, { type PaymentRow } from './PaymentsClient';

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default async function PaymentsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('payments')
    .select(
      `id, amount, currency, status, payment_method, razorpay_payment_id, razorpay_order_id, paid_at, created_at, order_id,
       orders(order_number),
       users(name, email)`,
    )
    .order('created_at', { ascending: false });

  const payments = (data ?? []) as unknown as PaymentRow[];

  const successful = payments.filter((p) => p.status === 'success');
  const captured = successful.reduce((sum, p) => sum + Number(p.amount), 0);
  const failedCount = payments.filter((p) => p.status === 'failed').length;

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Payment Records</h2>
        <p className="text-sm text-muted">{payments.length} transactions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Total Captured" value={formatINR(captured)} subtitle="Successful payments" icon="₹" color="green" />
        <StatsCard title="Successful" value={successful.length} icon="✓" color="green" />
        <StatsCard title="Failed" value={failedCount} icon="✕" color="red" />
      </div>

      <PaymentsClient payments={payments} />
    </div>
  );
}
