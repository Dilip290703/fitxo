import { createClient } from '@/lib/supabase/server';
import CouponsClient from './CouponsClient';

export default async function CouponsPage() {
  const supabase = await createClient();
  const { data: coupons } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });

  return (
    <div className="space-y-4 max-w-5xl">
      <h2 className="text-xl font-bold text-white">Coupons</h2>
      <CouponsClient coupons={coupons ?? []} />
    </div>
  );
}
