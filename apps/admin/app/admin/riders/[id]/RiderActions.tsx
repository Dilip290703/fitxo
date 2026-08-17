'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitxo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { logActivity } from '@/lib/activity';
import type { Rider } from '@fitxo/supabase/types';

export default function RiderActions({ rider }: { rider: Rider }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [confirmVerify, setConfirmVerify] = useState(false);

  const update = async (patch: Partial<Rider>, action: string) => {
    setLoading(true);
    const { error } = await supabase.from('riders').update(patch).eq('id', rider.id);
    setLoading(false);
    setConfirmVerify(false);
    if (error) toast(error.message, 'error');
    else {
      await logActivity(supabase, {
        action,
        entity_type: 'rider',
        entity_id: rider.id,
        new_value: patch as Record<string, unknown>,
      });
      toast('Rider updated', 'success');
      router.refresh();
    }
  };

  return (
    <>
      <div className="bg-white border border-line rounded-xl p-5 space-y-2">
        <h3 className="text-xs font-semibold text-soft uppercase tracking-wide mb-2">Actions</h3>
        <button
          onClick={() =>
            update({ is_available: !rider.is_available }, rider.is_available ? 'Marked rider unavailable' : 'Marked rider available')
          }
          disabled={loading}
          className="w-full py-2 text-sm border border-line-strong text-body hover:text-ink rounded-lg transition-colors disabled:opacity-60"
        >
          {rider.is_available ? 'Mark Unavailable' : 'Mark Available'}
        </button>
        <button
          onClick={() => setConfirmVerify(true)}
          disabled={loading}
          className={`w-full py-2 text-sm rounded-lg transition-colors disabled:opacity-60 ${
            rider.is_verified
              ? 'border border-danger-line text-danger hover:bg-danger-bg'
              : 'bg-green-600 hover:bg-green-500 text-white'
          }`}
        >
          {rider.is_verified ? 'Revoke Verification' : 'Verify Rider'}
        </button>
      </div>

      {/* Verification gates the whole agent panel — make it deliberate. */}
      <ConfirmDialog
        open={confirmVerify}
        title={rider.is_verified ? 'Revoke Verification' : 'Verify Rider'}
        message={
          rider.is_verified
            ? 'This rider will immediately lose access to delivery jobs and the agent panel workflow.'
            : 'This rider will be able to go online, see delivery offers, and claim jobs.'
        }
        confirmLabel={rider.is_verified ? 'Revoke' : 'Verify'}
        destructive={rider.is_verified}
        onConfirm={() =>
          update({ is_verified: !rider.is_verified }, rider.is_verified ? 'Revoked rider verification' : 'Verified rider')
        }
        onCancel={() => setConfirmVerify(false)}
      />
    </>
  );
}
