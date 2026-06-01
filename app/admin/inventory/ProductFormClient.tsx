'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProduct, updateProduct } from './actions';
import { useToast } from '@/components/admin/Toast';
import ColorVariantBuilder, { ColorEntry } from '@/components/admin/ColorVariantBuilder';
import ImageUploader from '@/components/admin/ImageUploader';
import type { Product } from '@/lib/supabase/types';

interface Option { id: string; name: string; parent_id?: string | null; }

interface ProductFormClientProps {
  stores: Option[];
  brands: Option[];
  categories: Option[];
  mode: 'create' | 'edit';
  product?: Partial<Product>;
}

const STEPS = ['Basic Info', 'Pricing', 'Colors & Sizes', 'Images', 'Review'];

interface FormData {
  name: string;
  slug: string;
  store_id: string;
  brand_id: string;
  category_id: string;
  description: string;
  short_description: string;
  material: string;
  care_instructions: string;
  fit_type: string;
  tags: string;
  base_price: string;
  discounted_price: string;
  deposit_amount: string;
  is_featured: boolean;
}

export default function ProductFormClient({ stores, brands, categories, mode, product }: ProductFormClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormData>({
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    store_id: product?.store_id ?? '',
    brand_id: product?.brand_id ?? '',
    category_id: product?.category_id ?? '',
    description: product?.description ?? '',
    short_description: product?.short_description ?? '',
    material: product?.material ?? '',
    care_instructions: product?.care_instructions ?? '',
    fit_type: product?.fit_type ?? '',
    tags: product?.tags?.join(', ') ?? '',
    base_price: String(product?.base_price ?? ''),
    discounted_price: String(product?.discounted_price ?? ''),
    deposit_amount: String(product?.deposit_amount ?? '0'),
    is_featured: product?.is_featured ?? false,
  });

  const [colors, setColors] = useState<ColorEntry[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const setField = (key: keyof FormData, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || autoSlug(form.name),
        store_id: form.store_id,
        brand_id: form.brand_id || null,
        category_id: form.category_id || null,
        description: form.description || null,
        short_description: form.short_description || null,
        material: form.material || null,
        care_instructions: form.care_instructions || null,
        fit_type: (form.fit_type as Product['fit_type']) || null,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        base_price: parseFloat(form.base_price),
        discounted_price: form.discounted_price ? parseFloat(form.discounted_price) : null,
        deposit_amount: parseFloat(form.deposit_amount) || 0,
        is_featured: form.is_featured,
        is_active: true,
        is_deleted: false,
      };

      const colorPayload = colors.map((c) => ({
        color_name: c.color_name,
        color_hex: c.color_hex,
        variants: c.variants.map((v) => ({ size: v.size, sku: v.sku, stock_qty: v.stock_qty })),
      }));

      if (mode === 'create') {
        await createProduct(payload, colorPayload, imageUrls);
      } else if (product?.id) {
        await updateProduct(product.id, payload, colorPayload, imageUrls);
      }

      toast(mode === 'create' ? 'Product created successfully!' : 'Product updated!', 'success');
      router.push('/admin/inventory');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors';
  const labelClass = 'block text-xs font-medium text-gray-400 mb-1.5';

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                i === step
                  ? 'bg-indigo-600 text-white'
                  : i < step
                  ? 'text-indigo-400 hover:bg-indigo-600/10'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              <span className={`w-4 h-4 rounded-full text-xs flex items-center justify-center ${i <= step ? 'bg-indigo-500 text-white' : 'bg-gray-700 text-gray-500'}`}>
                {i < step ? '✓' : i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-gray-700" />}
          </div>
        ))}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        {/* Step 0: Basic Info */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Product Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => { setField('name', e.target.value); setField('slug', autoSlug(e.target.value)); }}
                  className={inputClass}
                  placeholder="e.g. Classic Oxford Shirt"
                />
              </div>
              <div>
                <label className={labelClass}>Slug</label>
                <input type="text" value={form.slug} onChange={(e) => setField('slug', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Store *</label>
                <select value={form.store_id} onChange={(e) => setField('store_id', e.target.value)} className={inputClass}>
                  <option value="">Select store</option>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Brand</label>
                <select value={form.brand_id} onChange={(e) => setField('brand_id', e.target.value)} className={inputClass}>
                  <option value="">Select brand</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <select value={form.category_id} onChange={(e) => setField('category_id', e.target.value)} className={inputClass}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Fit Type</label>
                <select value={form.fit_type} onChange={(e) => setField('fit_type', e.target.value)} className={inputClass}>
                  <option value="">Select fit</option>
                  <option value="slim">Slim</option>
                  <option value="regular">Regular</option>
                  <option value="oversized">Oversized</option>
                  <option value="relaxed">Relaxed</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Material</label>
                <input type="text" value={form.material} onChange={(e) => setField('material', e.target.value)} className={inputClass} placeholder="e.g. 100% Cotton" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Short Description</label>
                <input type="text" value={form.short_description} onChange={(e) => setField('short_description', e.target.value)} className={inputClass} placeholder="One-liner shown on product cards" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Full Description</label>
                <textarea value={form.description} onChange={(e) => setField('description', e.target.value)} rows={4} className={inputClass} placeholder="Detailed product description" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Care Instructions</label>
                <input type="text" value={form.care_instructions} onChange={(e) => setField('care_instructions', e.target.value)} className={inputClass} placeholder="e.g. Machine wash cold, tumble dry low" />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Tags (comma-separated)</label>
                <input type="text" value={form.tags} onChange={(e) => setField('tags', e.target.value)} className={inputClass} placeholder="summer, formal, cotton, casual" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="is_featured" checked={form.is_featured} onChange={(e) => setField('is_featured', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                <label htmlFor="is_featured" className="text-sm text-gray-300">Featured product</label>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Pricing */}
        {step === 1 && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className={labelClass}>Base Price (₹) *</label>
              <input type="number" value={form.base_price} onChange={(e) => setField('base_price', e.target.value)} min={0} className={inputClass} placeholder="0.00" />
            </div>
            <div>
              <label className={labelClass}>Discounted Price (₹)</label>
              <input type="number" value={form.discounted_price} onChange={(e) => setField('discounted_price', e.target.value)} min={0} className={inputClass} placeholder="Leave empty if no discount" />
            </div>
            <div>
              <label className={labelClass}>Try-on Deposit (₹)</label>
              <p className="text-xs text-gray-500 mb-1.5">Refundable deposit collected at delivery, applied to purchase</p>
              <input type="number" value={form.deposit_amount} onChange={(e) => setField('deposit_amount', e.target.value)} min={0} className={inputClass} placeholder="0.00" />
            </div>
          </div>
        )}

        {/* Step 2: Colors & Sizes */}
        {step === 2 && (
          <div>
            <p className="text-sm text-gray-400 mb-4">Add colors, then sizes and stock for each color.</p>
            <ColorVariantBuilder value={colors} onChange={setColors} />
          </div>
        )}

        {/* Step 3: Images */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Upload product images. First image will be the primary.</p>
            <div className="grid grid-cols-3 gap-3">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative bg-gray-700 rounded-lg p-2 text-xs text-gray-400 break-all">
                  <span className="absolute top-1 left-1 bg-indigo-600 text-white text-xs px-1 rounded">{i === 0 ? 'Primary' : `#${i + 1}`}</span>
                  {url}
                  <button onClick={() => setImageUrls((arr) => arr.filter((_, j) => j !== i))} className="absolute top-1 right-1 text-red-400 hover:text-red-300">✕</button>
                </div>
              ))}
              <ImageUploader
                bucket="product-images"
                folder="products"
                onUpload={(url) => setImageUrls((arr) => [...arr, url])}
                className="col-span-1"
              />
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Review before publishing</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Name', form.name],
                ['Store', stores.find((s) => s.id === form.store_id)?.name ?? '—'],
                ['Brand', brands.find((b) => b.id === form.brand_id)?.name ?? '—'],
                ['Category', categories.find((c) => c.id === form.category_id)?.name ?? '—'],
                ['Base Price', `₹${form.base_price}`],
                ['Discounted', form.discounted_price ? `₹${form.discounted_price}` : '—'],
                ['Deposit', `₹${form.deposit_amount}`],
                ['Colors', `${colors.length} color(s), ${colors.reduce((s, c) => s + c.variants.length, 0)} variant(s)`],
                ['Images', `${imageUrls.length} image(s)`],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-700/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2 text-sm bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Publishing…' : mode === 'create' ? 'Publish Product' : 'Save Changes'}
          </button>
        )}
      </div>
    </div>
  );
}
