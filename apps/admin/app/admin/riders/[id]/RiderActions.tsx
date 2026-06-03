'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import type { Rider } from '@fitzo/supabase/types';

export default function RiderActions({ rider }: { rider: Rider }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const update = async (patch: Partial<Rider>) => {
    setLoading(true);
    const { error } = await supabase.from('riders').update(patch).eq('id', rider.id);
    setLoading(false);
    if (error) toast(error.message, 'error');
    else { toast('Rider updated', 'success'); router.refresh(); }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Actions</h3>
      <button
        onClick={() => update({ is_available: !rider.is_available })}
        disabled={loading}
        className="w-full py-2 text-sm border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 rounded-lg transition-colors disabled:opacity-60"
      >
        {rider.is_available ? 'Mark Unavailable' : 'Mark Available'}
      </button>
      <button
        onClick={() => update({ is_verified: !rider.is_verified })}
        disabled={loading}
        className={`w-full py-2 text-sm rounded-lg transition-colors disabled:opacity-60 ${
          rider.is_verified
            ? 'border border-red-700 text-red-400 hover:bg-red-900/20'
            : 'bg-green-600 hover:bg-green-500 text-white'
        }`}
      >
        {rider.is_verified ? 'Revoke Verification' : 'Verify Rider'}
      </button>
    </div>
  );
}
