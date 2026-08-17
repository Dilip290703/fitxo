import { createClient } from '@fitxo/supabase/server';
import CouponsClient from './CouponsClient';

export default async function CouponsPage() {
  const supabase = await createClient();
  // coupons has no created_at column — ordering by it errors and blanked the list
  const { data: coupons } = await supabase.from('coupons').select('*').order('valid_from', { ascending: false });

  return (
    <div className="space-y-4 max-w-5xl">
      <h2 className="text-xl font-bold text-ink">Coupons</h2>
      <CouponsClient coupons={coupons ?? []} />
    </div>
  );
}
