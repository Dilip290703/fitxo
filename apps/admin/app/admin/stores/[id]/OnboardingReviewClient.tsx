'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import { logActivity } from '@/lib/activity';
import type { StoreBusinessDetails, StoreOnboardingStatus } from '@fitzo/supabase/types';

const STATUS_PILL: Record<StoreOnboardingStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-700 text-gray-300' },
  submitted: { label: 'Awaiting review', cls: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  approved: { label: 'Approved', cls: 'bg-green-500/15 text-green-300 border border-green-500/30' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/15 text-red-300 border border-red-500/30' },
};

export default function OnboardingReviewClient({
  storeId,
  storeName,
  status,
  submittedAt,
  rejectionReason,
  business,
}: {
  storeId: string;
  storeName: string;
  status: StoreOnboardingStatus;
  submittedAt: string | null;
  rejectionReason: string | null;
  business: StoreBusinessDetails | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const pill = STATUS_PILL[status] ?? STATUS_PILL.draft;

  const approve = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('stores')
      .update({
        onboarding_status: 'approved',
        is_active: true,
        is_verified: true,
        rejection_reason: null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', storeId);
    setBusy(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    await logActivity(supabase, {
      action: 'Approved store onboarding',
      entity_type: 'store',
      entity_id: storeId,
      new_value: { onboarding_status: 'approved' },
    });
    toast(`${storeName} approved & activated`, 'success');
    router.refresh();
  };

  const reject = async () => {
    if (!reason.trim()) {
      toast('Add a reason so the store knows what to fix', 'error');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('stores')
      .update({
        onboarding_status: 'rejected',
        is_active: false,
        is_verified: false,
        rejection_reason: reason.trim(),
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', storeId);
    setBusy(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    await logActivity(supabase, {
      action: 'Rejected store onboarding',
      entity_type: 'store',
      entity_id: storeId,
      new_value: { onboarding_status: 'rejected', rejection_reason: reason.trim() },
    });
    toast('Application sent back for changes', 'success');
    setRejecting(false);
    setReason('');
    router.refresh();
  };

  const rows: [string, string | null | undefined][] = [
    ['Legal name', business?.legal_name],
    ['Entity type', business?.entity_type],
    ['PAN', business?.pan_number],
    ['GST', business?.gst_number || 'Not registered'],
    ['Bank a/c name', business?.bank_account_name],
    ['Bank a/c no.', business?.bank_account_number],
    ['IFSC', business?.bank_ifsc],
    ['UPI', business?.upi_id],
  ];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Onboarding</h3>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${pill.cls}`}>{pill.label}</span>
      </div>

      {submittedAt && (
        <p className="text-xs text-gray-500">Submitted {new Date(submittedAt).toLocaleString()}</p>
      )}
      {status === 'rejected' && rejectionReason && (
        <p className="text-xs text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          Sent back: {rejectionReason}
        </p>
      )}

      {/* Submitted business / KYC / payout details */}
      <dl className="divide-y divide-gray-700/60 rounded-lg border border-gray-700">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3 px-3 py-1.5">
            <dt className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-gray-500">{k}</dt>
            <dd className="min-w-0 flex-1 break-words text-sm text-gray-200">{v || '—'}</dd>
          </div>
        ))}
      </dl>

      {/* Actions */}
      {status === 'draft' ? (
        <p className="text-sm text-gray-500">Store hasn&apos;t submitted its application yet.</p>
      ) : rejecting ? (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="What does the store need to fix? (shown to the store)"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <div className="flex gap-2">
            <button
              onClick={reject}
              disabled={busy}
              className="flex-1 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-medium rounded-lg"
            >
              {busy ? 'Sending…' : 'Confirm reject'}
            </button>
            <button
              onClick={() => { setRejecting(false); setReason(''); }}
              disabled={busy}
              className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={approve}
            disabled={busy}
            className="flex-1 py-2 text-sm bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-medium rounded-lg"
          >
            {status === 'approved' ? 'Re-activate' : 'Approve & activate'}
          </button>
          {status !== 'rejected' && (
            <button
              onClick={() => setRejecting(true)}
              disabled={busy}
              className="px-4 py-2 text-sm border border-red-500/40 text-red-300 rounded-lg hover:bg-red-500/10"
            >
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}
