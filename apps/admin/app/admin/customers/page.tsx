import { createClient } from '@fitzo/supabase/server';
import CustomersClient from './CustomersClient';

export default async function CustomersPage() {
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from('users')
    .select('id, name, email, phone, is_active, is_blocked, created_at, orders(id, final_amount)')
    .eq('role', 'customer')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h2 className="text-xl font-bold text-white">Customers</h2>
        <p className="text-sm text-gray-500">{customers?.length ?? 0} customers</p>
      </div>
      <CustomersClient customers={customers ?? []} />
    </div>
  );
}
