'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/admin/Toast';
import { recordAgentPayout } from './actions';

export interface AgentPayableRow {
  riderId: string;
  riderName: string;
  completedJobs: number;
  grossEarned: number;
  netOutstanding: number;
  totalPaid: number;
  destination: string | null;
  unpaidCount: number;
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
}

export default function AgentPayoutsClient({ rows }: { rows: AgentPayableRow[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<AgentPayableRow | null>(null);
  const [reference, setReference] = useState('');

  const close = () => {
    setConfirm(null);
    setReference('');
  };

  const pay = (rider: AgentPayableRow) => {
    startTransition(async () => {
      try {
        const { count, amount } = await recordAgentPayout(rider.riderId, reference);
        toast(`Paid ${formatINR(amount)} to ${rider.riderName} (${count} jobs)`, 'success');
        close();
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Payout failed', 'error');
      }
    });
  };

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/60">
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Rider</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Pay to</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-soft uppercase tracking-wide">Jobs</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-soft uppercase tracking-wide">Earned</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-soft uppercase tracking-wide">Paid</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-soft uppercase tracking-wide">Outstanding</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-soft uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted">No verified riders.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.riderId} className="border-b border-hairline hover:bg-cream transition-colors">
                  <td className="px-4 py-3 text-ink">{r.riderName}</td>
                  <td className="px-4 py-3">
                    {r.destination ? (
                      <span className="font-mono text-xs text-body">{r.destination}</span>
                    ) : (
                      <span className="inline-block rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">
                        No payout details
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-soft">{r.completedJobs}</td>
                  <td className="px-4 py-3 text-right text-body">{formatINR(r.grossEarned)}</td>
                  <td className="px-4 py-3 text-right text-soft">{formatINR(r.totalPaid)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${r.netOutstanding > 0 ? 'text-warn' : 'text-muted'}`}>
                    {formatINR(r.netOutstanding)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setConfirm(r)}
                      disabled={r.netOutstanding <= 0 || isPending}
                      className="px-3 py-1.5 text-xs bg-ink hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg"
                    >
                      Record payout
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !isPending && close()}>
          <div className="w-full max-w-md bg-white border border-line rounded-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-ink">Record payout</h3>
            <p className="text-sm text-soft">
              Settle <span className="text-ink font-medium">{formatINR(confirm.netOutstanding)}</span> to{' '}
              <span className="text-ink">{confirm.riderName}</span> across {confirm.unpaidCount} completed job(s)?
            </p>
            {confirm.destination ? (
              <p className="text-xs text-body bg-cream border border-line rounded-lg px-3 py-2 font-mono">
                Pay to: {confirm.destination}
              </p>
            ) : (
              <p className="text-xs text-danger bg-danger-bg border border-danger-line rounded-lg px-3 py-2">
                This rider has NOT added bank/UPI details — there is nowhere to send the money.
                Recording anyway marks these jobs as settled in the ledger.
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-soft mb-1" htmlFor="agent-payout-ref">
                Payment reference — UTR / UPI txn id (optional, audit trail)
              </label>
              <input
                id="agent-payout-ref"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. 415712345678"
                className="w-full bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink font-mono"
              />
            </div>
            <p className="text-xs text-warn bg-warn-bg border border-warn-accent/40 rounded-lg px-3 py-2">
              Ledger entry only — make the bank/UPI transfer yourself and paste its reference above.
              Automatic disbursement is blocked on the RazorpayX account (docs/PAYOUTS-GOING-LIVE.md).
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={close} disabled={isPending} className="px-4 py-2 text-sm border border-line-strong text-body rounded-lg hover:border-line-strong">
                Cancel
              </button>
              <button onClick={() => pay(confirm)} disabled={isPending} className="px-4 py-2 text-sm bg-ink hover:bg-ink-soft disabled:opacity-50 text-white font-medium rounded-lg">
                {isPending ? 'Recording…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
