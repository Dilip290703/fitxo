import { createClient } from '@fitzo/supabase/server';
import OrdersClient from './OrdersClient';
import type { OrderStatus } from '@fitzo/supabase/types';

type OrderRow = {
  id: string; order_number: string; status: OrderStatus; final_amount: number;
  payment_status: string; created_at: string; try_deadline: string | null;
  users: { name: string; email: string; phone: string } | null;
  order_items: { id: string }[];
};

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, final_amount, payment_status, created_at, try_deadline,
      users(name, email, phone),
      order_items(id)
    `)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h2 className="text-xl font-bold text-ink">Orders</h2>
        <p className="text-sm text-muted">{orders?.length ?? 0} total orders</p>
      </div>
      <OrdersClient orders={(orders ?? []) as unknown as OrderRow[]} />
    </div>
  );
}
