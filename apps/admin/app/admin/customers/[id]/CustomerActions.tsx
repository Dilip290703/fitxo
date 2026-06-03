'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import type { User } from '@fitzo/supabase/types';

export default function CustomerActions({ customer }: { customer: User }) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const toggleBlock = async () => {
    setLoading(true);
    const { error } = await supabase.from('users').update({ is_blocked: !customer.is_blocked }).eq('id', customer.id);
    setLoading(false);
    setConfirm(false);
    if (error) toast(error.message, 'error');
    else { toast(customer.is_blocked ? 'Customer unblocked' : 'Customer blocked', 'success'); router.refresh(); }
  };

  return (
    <>
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Actions</h3>
        <button
          onClick={() => setConfirm(true)}
          disabled={loading}
          className={`w-full py-2 text-sm rounded-lg transition-colors disabled:opacity-60 ${
            customer.is_blocked
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'border border-red-700 text-red-400 hover:bg-red-900/20'
          }`}
        >
          {customer.is_blocked ? 'Unblock Customer' : 'Block Customer'}
        </button>
      </div>

      <ConfirmDialog
        open={confirm}
        title={customer.is_blocked ? 'Unblock Customer' : 'Block Customer'}
        message={customer.is_blocked
          ? 'This will restore the customer\'s access.'
          : 'This will prevent the customer from placing orders.'}
        confirmLabel={customer.is_blocked ? 'Unblock' : 'Block'}
        destructive={!customer.is_blocked}
        onConfirm={toggleBlock}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
