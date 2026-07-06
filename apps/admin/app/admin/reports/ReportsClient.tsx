'use client';

import { useState } from 'react';
import { createClient } from '@fitzo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import { logActivity } from '@/lib/activity';

interface ReportDef {
  key: string;
  label: string;
  description: string;
  table: string;
  select: string;
  filename: string;
}

const REPORTS: ReportDef[] = [
  { key: 'orders', label: 'Orders', description: 'All orders with status, amounts, timestamps', table: 'orders', select: 'id, order_number, status, payment_status, final_amount, created_at', filename: 'orders' },
  { key: 'payments', label: 'Payments', description: 'Razorpay payment transactions', table: 'payments', select: 'id, order_id, amount, currency, status, payment_method, razorpay_payment_id, paid_at, created_at', filename: 'payments' },
  { key: 'customers', label: 'Customers', description: 'User accounts (name, email, phone, role)', table: 'users', select: 'id, name, email, phone, role, is_blocked, created_at', filename: 'users' },
  { key: 'products', label: 'Products', description: 'Catalogue with pricing and status', table: 'products', select: 'id, name, slug, base_price, discounted_price, is_active, is_deleted, created_at', filename: 'products' },
  { key: 'payouts', label: 'Payouts', description: 'Store payout ledger', table: 'payouts', select: 'id, store_id, order_id, amount, status, paid_at, created_at', filename: 'payouts' },
];

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return lines.join('\n');
}

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsClient() {
  const { toast } = useToast();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);

  const exportReport = async (report: ReportDef) => {
    setBusy(report.key);
    try {
      const { data, error } = await supabase.from(report.table).select(report.select).order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      if (rows.length === 0) {
        toast(`No ${report.label.toLowerCase()} to export`, 'error');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      download(`fitzo-${report.filename}-${stamp}.csv`, toCSV(rows));
      await logActivity(supabase, { action: `Exported ${report.label} report`, entity_type: 'report', new_value: { dataset: report.key, rows: rows.length } });
      toast(`Exported ${rows.length} ${report.label.toLowerCase()} rows`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {REPORTS.map((r) => (
        <div key={r.key} className="bg-white border border-line rounded-xl p-5 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">{r.label}</h3>
            <p className="text-xs text-muted mt-0.5">{r.description}</p>
          </div>
          <button
            onClick={() => exportReport(r)}
            disabled={busy === r.key}
            className="mt-auto w-fit px-4 py-2 text-sm bg-ink hover:bg-ink-soft disabled:opacity-50 text-white font-medium rounded-lg"
          >
            {busy === r.key ? 'Exporting…' : '↓ Export CSV'}
          </button>
        </div>
      ))}
    </div>
  );
}
