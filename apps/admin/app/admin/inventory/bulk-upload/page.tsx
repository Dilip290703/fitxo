'use client';

import { useState, useRef } from 'react';
import { createClient } from '@fitzo/supabase/client';
import { useToast } from '@/components/admin/Toast';
import { useRouter } from 'next/navigation';
import { logActivity } from '@/lib/activity';

interface CSVRow {
  name: string;
  slug: string;
  store_id: string;
  brand_id: string;
  category_id: string;
  base_price: string;
  discounted_price: string;
  deposit_amount: string;
  description: string;
  tags: string;
  color_name: string;
  color_hex: string;
  size: string;
  sku: string;
  stock_qty: string;
  _status?: 'pending' | 'success' | 'error';
  _error?: string;
}

const CSV_TEMPLATE_HEADERS = [
  'name', 'slug', 'store_id', 'brand_id', 'category_id',
  'base_price', 'discounted_price', 'deposit_amount',
  'description', 'tags', 'color_name', 'color_hex',
  'size', 'sku', 'stock_qty',
].join(',');

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return { ...row, _status: 'pending' } as CSVRow;
  });
}

export default function BulkUploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  const [rows, setRows] = useState<CSVRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const handleCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRows(parseCSV(text));
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_HEADERS + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fitzo-product-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const processRows = async () => {
    setUploading(true);
    setProgress({ done: 0, total: rows.length });

    const updated = [...rows];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Upsert product
        const { data: product, error: pErr } = await supabase
          .from('products')
          .upsert({
            name: row.name,
            slug: row.slug || row.name.toLowerCase().replace(/\s+/g, '-'),
            store_id: row.store_id,
            brand_id: row.brand_id || null,
            category_id: row.category_id || null,
            base_price: parseFloat(row.base_price) || 0,
            discounted_price: row.discounted_price ? parseFloat(row.discounted_price) : null,
            deposit_amount: parseFloat(row.deposit_amount) || 0,
            description: row.description || null,
            tags: row.tags.split('|').map((t) => t.trim()).filter(Boolean),
            is_active: true,
            is_deleted: false,
          }, { onConflict: 'slug' })
          .select('id')
          .single();

        if (pErr) throw pErr;

        // Upsert color
        const { data: color, error: cErr } = await supabase
          .from('product_colors')
          .upsert({
            product_id: product.id,
            color_name: row.color_name,
            color_hex: row.color_hex || null,
          }, { onConflict: 'product_id,color_name' } as { onConflict: string })
          .select('id')
          .single();

        if (cErr) throw cErr;

        // Upsert variant
        const { error: vErr } = await supabase
          .from('product_variants')
          .upsert({
            product_id: product.id,
            color_id: color.id,
            size: row.size,
            sku: row.sku,
            stock_qty: parseInt(row.stock_qty) || 0,
            size_type: 'alpha',
          }, { onConflict: 'sku' });

        if (vErr) throw vErr;

        updated[i] = { ...row, _status: 'success' };
      } catch (err) {
        updated[i] = { ...row, _status: 'error', _error: err instanceof Error ? err.message : 'Unknown error' };
      }

      setRows([...updated]);
      setProgress({ done: i + 1, total: rows.length });
    }

    const errorCount = updated.filter((r) => r._status === 'error').length;
    const successCount = updated.filter((r) => r._status === 'success').length;

    if (successCount > 0) {
      await logActivity(supabase, { action: `Bulk imported ${successCount} products`, entity_type: 'product', new_value: { succeeded: successCount, failed: errorCount } });
    }

    if (errorCount === 0) {
      toast(`All ${successCount} rows imported successfully!`, 'success');
      router.refresh();
    } else {
      toast(`${successCount} succeeded, ${errorCount} failed. Check errors below.`, 'error');
    }

    setUploading(false);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">Bulk Upload Products</h2>
          <p className="text-sm text-muted mt-0.5">Import products via CSV file</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="px-4 py-2 text-sm border border-line-strong text-body hover:text-ink rounded-lg"
        >
          ↓ Download Template
        </button>
      </div>

      {/* Upload area */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-line-strong rounded-xl p-10 text-center cursor-pointer hover:border-line-strong transition-colors"
      >
        <p className="text-3xl mb-2">📋</p>
        <p className="text-sm text-soft">Click to select a CSV file</p>
        <p className="text-xs text-faint mt-1">One variant per row. Use | to separate multiple tags.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); }}
        />
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-soft">{rows.length} rows parsed</p>
            {!uploading && (
              <button
                onClick={processRows}
                className="px-4 py-2 text-sm bg-ink hover:bg-ink-soft text-white font-medium rounded-lg"
              >
                Import All
              </button>
            )}
          </div>

          {uploading && (
            <div className="bg-white border border-line rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-body">Importing…</p>
                <p className="text-sm text-info">{progress.done}/{progress.total}</p>
              </div>
              <div className="w-full bg-sand rounded-full h-2">
                <div
                  className="bg-ink h-2 rounded-full transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line bg-cream/60">
                  <th className="px-3 py-2 text-left text-soft font-medium">Status</th>
                  <th className="px-3 py-2 text-left text-soft font-medium">Name</th>
                  <th className="px-3 py-2 text-left text-soft font-medium">SKU</th>
                  <th className="px-3 py-2 text-left text-soft font-medium">Color</th>
                  <th className="px-3 py-2 text-left text-soft font-medium">Size</th>
                  <th className="px-3 py-2 text-right text-soft font-medium">Price</th>
                  <th className="px-3 py-2 text-right text-soft font-medium">Stock</th>
                  <th className="px-3 py-2 text-left text-soft font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-hairline ${row._status === 'error' ? 'bg-danger-bg/10' : row._status === 'success' ? 'bg-success-bg/10' : ''}`}>
                    <td className="px-3 py-2">
                      {row._status === 'success' && <span className="text-success">✓</span>}
                      {row._status === 'error' && <span className="text-danger">✕</span>}
                      {row._status === 'pending' && <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-2 text-body">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-soft">{row.sku}</td>
                    <td className="px-3 py-2 text-body">{row.color_name}</td>
                    <td className="px-3 py-2 text-body">{row.size}</td>
                    <td className="px-3 py-2 text-right text-body">₹{row.base_price}</td>
                    <td className="px-3 py-2 text-right text-body">{row.stock_qty}</td>
                    <td className="px-3 py-2 text-danger text-xs max-w-xs truncate">{row._error ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
