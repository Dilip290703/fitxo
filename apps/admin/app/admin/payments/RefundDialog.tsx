'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { refundPayment } from './actions';
import type { PaymentRow } from './PaymentsClient';

function formatINR(n: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(n);
}

/**
 * Confirm-with-reason modal for the one write action on Payment Records:
 * full-refund a successful Razorpay payment. Reason is required — it lands on
 * the payments row, in the audit log, and in the Razorpay refund notes.
 */
export default function RefundDialog({ payment, onClose }: { payment: PaymentRow; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    if (pending || !reason.trim()) return;
    setPending(true);
    setError(null);
    const result = await refundPayment(payment.id, reason);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={pending ? undefined : onClose} />
      <div className="relative bg-white border border-line rounded-xl p-6 w-full max-w-md shadow-pop">
        {done ? (
          <>
            <h3 className="text-base font-semibold text-ink mb-2">Refund issued</h3>
            <p className="text-sm text-soft mb-6">
              {formatINR(Number(payment.amount), payment.currency)} is on its way back to{' '}
              {payment.users?.name ?? 'the customer'}. Razorpay typically settles refunds in 5–7
              working days.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-ink hover:bg-ink-soft text-white transition-colors"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold text-ink mb-2">Refund this payment?</h3>
            <div className="space-y-1 text-sm text-body mb-4">
              <div className="flex justify-between">
                <span className="text-soft">Amount</span>
                <span className="font-medium text-ink">{formatINR(Number(payment.amount), payment.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-soft">Customer</span>
                <span>{payment.users?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-soft">Order</span>
                <span className="font-mono text-xs">{payment.orders?.order_number ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-soft">Payment ID</span>
                <span className="font-mono text-xs">{payment.razorpay_payment_id}</span>
              </div>
            </div>

            <label className="block text-xs font-medium text-soft mb-1" htmlFor="refund-reason">
              Reason (required — audit-logged)
            </label>
            <textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. delivery fee charged twice on FTZ-2026-00051"
              className="w-full bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink"
            />

            <p className="mt-3 rounded-lg bg-danger-bg px-3 py-2 text-xs text-danger">
              This sends the full amount back to the customer through Razorpay and can&apos;t be
              undone. Order/item state is not changed — adjust the order separately if needed.
            </p>

            {error && <p className="mt-3 text-xs text-danger">{error}</p>}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                disabled={pending}
                className="px-4 py-2 text-sm text-body hover:text-ink border border-line-strong rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={pending || !reason.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-danger hover:bg-danger-strong text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? 'Refunding…' : 'Refund payment'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
