'use client';

import { useState, useTransition } from 'react';
import StatusBadge from '@/components/admin/StatusBadge';
import { useToast } from '@/components/admin/Toast';
import { saveContentBlock, deleteContentBlock, type ContentType } from './actions';

export interface ContentRow {
  id: string;
  key: string;
  title: string;
  body: string;
  type: ContentType;
  is_published: boolean;
  updated_at: string;
}

const TYPES: ContentType[] = ['page', 'banner', 'faq', 'announcement'];

const emptyForm = { id: undefined as string | undefined, key: '', title: '', body: '', type: 'page' as ContentType, is_published: false };

const inputClass = 'w-full bg-sand border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-ink';

export default function ContentClient({ blocks }: { blocks: ContentRow[] }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<typeof emptyForm | null>(null);

  const openNew = () => setForm({ ...emptyForm });
  const openEdit = (b: ContentRow) => setForm({ id: b.id, key: b.key, title: b.title, body: b.body, type: b.type, is_published: b.is_published });

  const save = () => {
    if (!form) return;
    startTransition(async () => {
      try {
        await saveContentBlock(form);
        toast('Content saved', 'success');
        setForm(null);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not save', 'error');
      }
    });
  };

  const remove = (b: ContentRow) => {
    if (!confirm(`Delete content block "${b.key}"?`)) return;
    startTransition(async () => {
      try {
        await deleteContentBlock(b.id);
        toast('Content deleted', 'success');
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not delete', 'error');
      }
    });
  };

  return (
    <div className="space-y-4">
      <button onClick={openNew} className="px-4 py-2 text-sm bg-ink hover:bg-ink-soft text-white font-medium rounded-lg">
        + New content block
      </button>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-cream/60">
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Key</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-soft uppercase tracking-wide">Published</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-soft uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody>
            {blocks.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted">No content blocks yet.</td></tr>
            ) : (
              blocks.map((b) => (
                <tr key={b.id} className="border-b border-hairline hover:bg-cream transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-info">{b.key}</td>
                  <td className="px-4 py-3 text-sm text-ink">{b.title}</td>
                  <td className="px-4 py-3"><StatusBadge status={b.type} size="sm" /></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${b.is_published ? 'text-success' : 'text-muted'}`}>{b.is_published ? 'Published' : 'Draft'}</span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => openEdit(b)} className="text-xs text-info hover:text-ink font-medium">Edit</button>
                    <button onClick={() => remove(b)} className="text-xs text-muted hover:text-danger">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !isPending && setForm(null)}>
          <div className="w-full max-w-lg bg-white border border-line rounded-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-ink">{form.id ? 'Edit' : 'New'} content block</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-soft mb-1.5">Key</label>
                <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className={inputClass} placeholder="home_hero" disabled={!!form.id} />
              </div>
              <div>
                <label className="block text-xs font-medium text-soft mb-1.5">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ContentType })} className={`${inputClass} capitalize`}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-soft mb-1.5">Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-soft mb-1.5">Body</label>
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5} className={inputClass} />
            </div>
            <label className="flex items-center gap-2 text-sm text-body">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="accent-ink" />
              Published (visible on the customer site)
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setForm(null)} disabled={isPending} className="px-4 py-2 text-sm border border-line-strong text-body rounded-lg hover:border-line-strong">Cancel</button>
              <button onClick={save} disabled={isPending || !form.key.trim() || !form.title.trim()} className="px-4 py-2 text-sm bg-ink hover:bg-ink-soft disabled:opacity-50 text-white font-medium rounded-lg">
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
