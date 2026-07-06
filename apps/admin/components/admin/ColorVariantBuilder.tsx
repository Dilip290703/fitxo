'use client';

import { useState } from 'react';

export interface ColorEntry {
  id: string;
  color_name: string;
  color_hex: string;
  variants: VariantEntry[];
}

export interface VariantEntry {
  id: string;
  size: string;
  sku: string;
  stock_qty: number;
}

interface ColorVariantBuilderProps {
  value: ColorEntry[];
  onChange: (colors: ColorEntry[]) => void;
}

function newColor(): ColorEntry {
  return { id: Math.random().toString(36).slice(2), color_name: '', color_hex: '#000000', variants: [] };
}

function newVariant(): VariantEntry {
  return { id: Math.random().toString(36).slice(2), size: '', sku: '', stock_qty: 0 };
}

export default function ColorVariantBuilder({ value, onChange }: ColorVariantBuilderProps) {
  const [expanded, setExpanded] = useState<string | null>(value[0]?.id ?? null);

  const addColor = () => {
    const c = newColor();
    onChange([...value, c]);
    setExpanded(c.id);
  };

  const removeColor = (id: string) => onChange(value.filter((c) => c.id !== id));

  const updateColor = (id: string, patch: Partial<ColorEntry>) =>
    onChange(value.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const addVariant = (colorId: string) => {
    onChange(
      value.map((c) =>
        c.id === colorId ? { ...c, variants: [...c.variants, newVariant()] } : c
      )
    );
  };

  const removeVariant = (colorId: string, variantId: string) =>
    onChange(
      value.map((c) =>
        c.id === colorId
          ? { ...c, variants: c.variants.filter((v) => v.id !== variantId) }
          : c
      )
    );

  const updateVariant = (colorId: string, variantId: string, patch: Partial<VariantEntry>) =>
    onChange(
      value.map((c) =>
        c.id === colorId
          ? { ...c, variants: c.variants.map((v) => (v.id === variantId ? { ...v, ...patch } : v)) }
          : c
      )
    );

  return (
    <div className="space-y-3">
      {value.map((color) => (
        <div key={color.id} className="border border-line rounded-xl overflow-hidden">
          {/* Color header */}
          <div
            className="flex items-center gap-3 px-4 py-3 bg-white/60 cursor-pointer"
            onClick={() => setExpanded(expanded === color.id ? null : color.id)}
          >
            <div
              className="w-5 h-5 rounded-full border border-line-strong"
              style={{ backgroundColor: color.color_hex }}
            />
            <span className="text-sm font-medium text-ink flex-1">
              {color.color_name || 'New Color'}
            </span>
            <span className="text-xs text-muted">{color.variants.length} sizes</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeColor(color.id); }}
              className="text-muted hover:text-danger text-xs"
            >
              ✕
            </button>
            <span className="text-muted text-xs">{expanded === color.id ? '▲' : '▼'}</span>
          </div>

          {expanded === color.id && (
            <div className="px-4 py-4 space-y-4 bg-white/30">
              {/* Color inputs */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-soft mb-1 block">Color Name</label>
                  <input
                    type="text"
                    value={color.color_name}
                    onChange={(e) => updateColor(color.id, { color_name: e.target.value })}
                    placeholder="e.g. Navy Blue"
                    className="w-full bg-white border border-line-strong rounded-lg px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div>
                  <label className="text-xs text-soft mb-1 block">Hex</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color.color_hex}
                      onChange={(e) => updateColor(color.id, { color_hex: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer bg-transparent border border-line-strong"
                    />
                    <input
                      type="text"
                      value={color.color_hex}
                      onChange={(e) => updateColor(color.id, { color_hex: e.target.value })}
                      className="w-24 bg-white border border-line-strong rounded-lg px-2 py-2 text-sm text-ink font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Variants */}
              <div>
                <p className="text-xs font-semibold text-soft uppercase tracking-wide mb-2">Sizes & Stock</p>
                {color.variants.length === 0 && (
                  <p className="text-xs text-faint italic mb-2">No sizes added yet</p>
                )}
                <div className="space-y-2">
                  {color.variants.map((v) => (
                    <div key={v.id} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={v.size}
                        onChange={(e) => updateVariant(color.id, v.id, { size: e.target.value })}
                        placeholder="Size (S/M/30)"
                        className="w-24 bg-white border border-line-strong rounded-lg px-2 py-1.5 text-sm text-ink"
                      />
                      <input
                        type="text"
                        value={v.sku}
                        onChange={(e) => updateVariant(color.id, v.id, { sku: e.target.value })}
                        placeholder="SKU"
                        className="flex-1 bg-white border border-line-strong rounded-lg px-2 py-1.5 text-sm text-ink font-mono"
                      />
                      <input
                        type="number"
                        value={v.stock_qty}
                        min={0}
                        onChange={(e) => updateVariant(color.id, v.id, { stock_qty: parseInt(e.target.value) || 0 })}
                        className="w-20 bg-white border border-line-strong rounded-lg px-2 py-1.5 text-sm text-ink"
                      />
                      <button
                        onClick={() => removeVariant(color.id, v.id)}
                        className="text-muted hover:text-danger text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => addVariant(color.id)}
                  className="mt-2 text-xs text-info hover:text-ink"
                >
                  + Add size
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addColor}
        className="w-full py-2.5 border border-dashed border-line-strong rounded-xl text-sm text-soft hover:text-ink hover:border-line-strong transition-colors"
      >
        + Add Color
      </button>
    </div>
  );
}
