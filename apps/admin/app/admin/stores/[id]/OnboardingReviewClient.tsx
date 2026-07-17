'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fitzo/supabase/client';
import { isPunePincode } from '@fitzo/pincode';
import { useToast } from '@/components/admin/Toast';
import { logActivity } from '@/lib/activity';
import type { StoreBusinessDetails, StoreOnboardingStatus } from '@fitzo/supabase/types';

const STATUS_PILL: Record<StoreOnboardingStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-sand text-body' },
  submitted: { label: 'Awaiting review', cls: 'bg-warn-bg text-warn border border-warn-accent/40' },
  approved: { label: 'Approved', cls: 'bg-success-bg text-success border border-success-line' },
  rejected: { label: 'Rejected', cls: 'bg-danger-bg text-danger border border-danger-line' },
};

export default function OnboardingReviewClient({
  storeId,
  storeName,
  status,
  submittedAt,
  rejectionReason,
  business,
  pincode,
}: {
  storeId: string;
  storeName: string;
  status: StoreOnboardingStatus;
  submittedAt: string | null;
  rejectionReason: string | null;
  business: StoreBusinessDetails | null;
  pincode: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [overriding, setOverriding] = useState(false);

  const pill = STATUS_PILL[status] ?? STATUS_PILL.draft;

  // G6: riders pick up FROM the store, so the store itself must sit inside the
  // delivery area — the same Pune list the customer app checks (@fitzo/pincode).
  // A store outside it (or with no pincode) is operationally undeliverable.
  const serviceable = !!pincode && isPunePincode(pincode);

  const approve = async (override = false) => {
    // Unserviceable → first click opens the override confirm instead of approving.
    if (!serviceable && !override) {
      setOverriding(true);
      return;
    }
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
      action: override
        ? 'Approved store onboarding (OVERRIDE: pincode outside delivery area)'
        : 'Approved store onboarding',
      entity_type: 'store',
      entity_id: storeId,
      new_value: override
        ? { onboarding_status: 'approved', serviceability_override: true, store_pincode: pincode || null }
        : { onboarding_status: 'approved' },
    });
    setOverriding(false);
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
    [
      'Pincode',
      pincode
        ? `${pincode} · ${serviceable ? 'in the delivery area (Pune)' : 'OUTSIDE the delivery area'}`
        : 'Not provided',
    ],
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
    <div className="bg-white border border-line rounded-xl p-5 mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-soft uppercase tracking-wide">Onboarding</h3>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${pill.cls}`}>{pill.label}</span>
      </div>

      {submittedAt && (
        <p className="text-xs text-muted">Submitted {new Date(submittedAt).toLocaleString()}</p>
      )}
      {status === 'rejected' && rejectionReason && (
        <p className="text-xs text-danger/90 bg-danger-bg border border-danger-line rounded-lg px-3 py-2">
          Sent back: {rejectionReason}
        </p>
      )}

      {/* Submitted business / KYC / payout details */}
      <dl className="divide-y divide-line/60 rounded-lg border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3 px-3 py-1.5">
            <dt className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-muted">{k}</dt>
            <dd className="min-w-0 flex-1 break-words text-sm text-body">{v || '—'}</dd>
          </div>
        ))}
      </dl>

      {/* Actions */}
      {status === 'draft' ? (
        <p className="text-sm text-muted">Store hasn&apos;t submitted its application yet.</p>
      ) : rejecting ? (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="What does the store need to fix? (shown to the store)"
            className="w-full bg-sand border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink"
          />
          <div className="flex gap-2">
            <button
              onClick={reject}
              disabled={busy}
              className="flex-1 py-2 text-sm bg-danger hover:bg-danger-strong disabled:opacity-60 text-white font-medium rounded-lg"
            >
              {busy ? 'Sending…' : 'Confirm reject'}
            </button>
            <button
              onClick={() => { setRejecting(false); setReason(''); }}
              disabled={busy}
              className="px-4 py-2 text-sm border border-line-strong text-body rounded-lg hover:bg-hairline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : overriding ? (
        <div className="space-y-2">
          <p className="text-xs text-warn bg-warn-bg border border-warn-accent/40 rounded-lg px-3 py-2">
            {pincode
              ? `Pincode ${pincode} is outside FitZo's delivery area — riders can't pick up from this store, so its orders can never be fulfilled. Approve only if delivery coverage is expanding here.`
              : 'This store has no pincode on file, so serviceability can’t be checked. Ask the store to complete its address, or approve only if you’ve verified the location yourself.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => approve(true)}
              disabled={busy}
              className="flex-1 py-2 text-sm bg-warn-accent hover:opacity-90 disabled:opacity-60 text-white font-medium rounded-lg"
            >
              {busy ? 'Approving…' : 'Approve anyway'}
            </button>
            <button
              onClick={() => setOverriding(false)}
              disabled={busy}
              className="px-4 py-2 text-sm border border-line-strong text-body rounded-lg hover:bg-hairline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {!serviceable && (
            <p className="text-xs text-warn bg-warn-bg border border-warn-accent/40 rounded-lg px-3 py-2">
              {pincode
                ? `⚠ Pincode ${pincode} is outside the delivery area — approval will ask for an override.`
                : '⚠ No pincode on file — approval will ask for an override.'}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => approve()}
              disabled={busy}
              className="flex-1 py-2 text-sm bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-medium rounded-lg"
            >
              {status === 'approved' ? 'Re-activate' : 'Approve & activate'}
            </button>
            {status !== 'rejected' && (
              <button
                onClick={() => setRejecting(true)}
                disabled={busy}
                className="px-4 py-2 text-sm border border-red-500/40 text-danger rounded-lg hover:bg-danger-bg"
              >
                Reject
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
