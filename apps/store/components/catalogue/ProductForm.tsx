"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FIT_TYPES,
  emptyColor,
  emptyProductDraft,
  emptyVariant,
  makeSlug,
  loadFormRefData,
  loadProductForEdit,
  createProductFull,
  updateProductFull,
  validate,
  type ColorDraft,
  type ProductDraft,
} from "@/lib/productForm";
import {
  MAX_IMAGES,
  loadProductImages,
  syncProductImages,
  validateImageFile,
  type ImageDraft,
} from "@/lib/productImages";

type Mode = "create" | "edit";

export function ProductForm({
  mode,
  storeId,
  productId,
}: {
  mode: Mode;
  storeId: string;
  productId?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProductDraft>(emptyProductDraft());
  const [colors, setColors] = useState<ColorDraft[]>([emptyColor()]);
  const [original, setOriginal] = useState<ColorDraft[]>([]);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [removedImages, setRemovedImages] = useState<ImageDraft[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const ref = await loadFormRefData();
      if (!active) return;
      setCategories(ref.categories);

      if (mode === "edit" && productId) {
        const [loaded, imgs] = await Promise.all([
          loadProductForEdit(productId, storeId),
          loadProductImages(productId),
        ]);
        if (!active) return;
        if (!loaded) {
          setNotFound(true);
          setLoadingInitial(false);
          return;
        }
        setDraft(loaded.draft);
        setColors(loaded.colors);
        setOriginal(loaded.colors);
        setImages(imgs);
      }
      setLoadingInitial(false);
    })();
    return () => {
      active = false;
    };
  }, [mode, productId, storeId]);

  const setField = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
  };

  // ---- colour / variant editing ----
  const updateColor = (ci: number, patch: Partial<ColorDraft>) =>
    setColors((cs) => cs.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const addColor = () => setColors((cs) => [...cs, emptyColor()]);
  const removeColor = (ci: number) =>
    setColors((cs) => (cs.length === 1 ? cs : cs.filter((_, i) => i !== ci)));
  const addVariant = (ci: number) =>
    updateColor(ci, { variants: [...colors[ci].variants, emptyVariant()] });
  const updateVariant = (ci: number, vi: number, patch: Partial<ColorDraft["variants"][number]>) =>
    updateColor(ci, {
      variants: colors[ci].variants.map((v, i) => (i === vi ? { ...v, ...patch } : v)),
    });
  const removeVariant = (ci: number, vi: number) =>
    updateColor(ci, {
      variants:
        colors[ci].variants.length === 1
          ? colors[ci].variants
          : colors[ci].variants.filter((_, i) => i !== vi),
    });

  // ---- image editing (pending files upload on save) ----
  const addImageFiles = (files: FileList | null) => {
    if (!files) return;
    setError("");
    const next: ImageDraft[] = [];
    for (const file of Array.from(files)) {
      if (images.length + next.length >= MAX_IMAGES) {
        setError(`Up to ${MAX_IMAGES} images per product.`);
        break;
      }
      const problem = validateImageFile(file);
      if (problem) {
        setError(problem);
        continue;
      }
      next.push({ url: URL.createObjectURL(file), file, isPrimary: false });
    }
    if (next.length === 0) return;
    setImages((imgs) => {
      const merged = [...imgs, ...next];
      // Ensure exactly one primary (default: the first image).
      if (!merged.some((i) => i.isPrimary) && merged.length > 0) merged[0] = { ...merged[0], isPrimary: true };
      return merged;
    });
  };

  const removeImage = (idx: number) =>
    setImages((imgs) => {
      const target = imgs[idx];
      if (target.id) setRemovedImages((r) => [...r, target]);
      if (target.file) URL.revokeObjectURL(target.url);
      const rest = imgs.filter((_, i) => i !== idx);
      if (target.isPrimary && rest.length > 0) rest[0] = { ...rest[0], isPrimary: true };
      return rest;
    });

  const setPrimaryImage = (idx: number) =>
    setImages((imgs) => imgs.map((img, i) => ({ ...img, isPrimary: i === idx })));

  const moveImage = (idx: number, dir: -1 | 1) =>
    setImages((imgs) => {
      const j = idx + dir;
      if (j < 0 || j >= imgs.length) return imgs;
      const next = [...imgs];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const handleSave = async () => {
    const validationError = validate(draft, colors);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      let savedId = productId;
      if (mode === "create") {
        savedId = await createProductFull(storeId, draft, colors);
      } else if (productId) {
        await updateProductFull(productId, storeId, draft, colors, original);
      }
      if (savedId) {
        await syncProductImages(savedId, storeId, images, removedImages);
      }
      router.push("/catalogue");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the product. Please try again.");
      setSaving(false);
    }
  };

  if (loadingInitial) {
    return <p className="px-6 py-10 text-[13px] uppercase tracking-[0.16em] text-[#958675]">Loading…</p>;
  }
  if (notFound) {
    return (
      <div className="px-6 py-10">
        <p className="text-[14px] text-[#b83c24]">Product not found in your store.</p>
        <button
          onClick={() => router.push("/catalogue")}
          className="mt-4 rounded-full border border-[#171d2b] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#171d2b]"
        >
          Back to catalogue
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 py-8 pb-28 sm:px-8 lg:py-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#958675]">
          Catalogue
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#171d2b] sm:text-[32px]">
          {mode === "create" ? "Add product" : "Edit product"}
        </h1>
      </header>

      {/* Details */}
      <Card title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" className="sm:col-span-2">
            <input
              className={inputClass}
              value={draft.name}
              onChange={(e) => {
                const name = e.target.value;
                setDraft((d) => ({
                  ...d,
                  name,
                  // auto-fill slug only while creating / if empty
                  slug: mode === "create" || !d.slug ? makeSlug(name) : d.slug,
                }));
                setError("");
              }}
            />
          </Field>
          <Field label="Slug">
            <input className={inputClass} value={draft.slug} onChange={(e) => setField("slug", e.target.value)} />
          </Field>
          <Field label="Category">
            <select
              className={inputClass}
              value={draft.categoryId}
              onChange={(e) => setField("categoryId", e.target.value)}
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Short description" className="sm:col-span-2">
            <input
              className={inputClass}
              value={draft.shortDescription}
              onChange={(e) => setField("shortDescription", e.target.value)}
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea
              className={`${inputClass} min-h-[90px] py-2.5`}
              value={draft.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </Field>
          <Field label="Material">
            <input className={inputClass} value={draft.material} onChange={(e) => setField("material", e.target.value)} />
          </Field>
          <Field label="Fit type">
            <select className={inputClass} value={draft.fitType} onChange={(e) => setField("fitType", e.target.value)}>
              <option value="">—</option>
              {FIT_TYPES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Care instructions" className="sm:col-span-2">
            <input
              className={inputClass}
              value={draft.careInstructions}
              onChange={(e) => setField("careInstructions", e.target.value)}
            />
          </Field>
          <Field label="Base price (₹)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={draft.basePrice}
              onChange={(e) => setField("basePrice", e.target.value)}
            />
          </Field>
          <Field label="Discounted price (₹)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={draft.discountedPrice}
              onChange={(e) => setField("discountedPrice", e.target.value)}
            />
          </Field>
          <Field label="Deposit (₹)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={draft.depositAmount}
              onChange={(e) => setField("depositAmount", e.target.value)}
            />
          </Field>
          <Field label="Tags (comma-separated)">
            <input className={inputClass} value={draft.tags} onChange={(e) => setField("tags", e.target.value)} />
          </Field>
          <div className="flex items-center gap-5 sm:col-span-2">
            <Toggle label="Active" checked={draft.isActive} onChange={(v) => setField("isActive", v)} />
            <Toggle label="Featured" checked={draft.isFeatured} onChange={(v) => setField("isFeatured", v)} />
          </div>
        </div>
      </Card>

      {/* Images */}
      <Card title="Images">
        <p className="-mt-1 mb-4 text-[12px] leading-5 text-[#7c7268]">
          Up to {MAX_IMAGES} photos. The ★ image is the cover customers see first.
          {mode === "create" ? " Images upload when you create the product." : ""}
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <div
              key={img.id ?? img.url}
              className={`group relative aspect-square overflow-hidden rounded-xl border ${
                img.isPrimary ? "border-[#ffd233] ring-2 ring-[#ffd233]/40" : "border-[#ece5da]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              {img.file ? (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-[#171d2b]/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white">
                  New
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                <button
                  type="button"
                  onClick={() => setPrimaryImage(i)}
                  title={img.isPrimary ? "Cover image" : "Make cover"}
                  className={`grid h-7 w-7 place-items-center rounded-full text-[13px] ${
                    img.isPrimary ? "bg-[#ffd233] text-[#171d2b]" : "bg-white/25 text-white hover:bg-white/40"
                  }`}
                >
                  ★
                </button>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveImage(i, -1)}
                    disabled={i === 0}
                    title="Move earlier"
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/25 text-[12px] text-white hover:bg-white/40 disabled:opacity-30"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(i, 1)}
                    disabled={i === images.length - 1}
                    title="Move later"
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/25 text-[12px] text-white hover:bg-white/40 disabled:opacity-30"
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    title="Remove image"
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/25 text-[14px] text-white hover:bg-[#b83c24]"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}

          {images.length < MAX_IMAGES ? (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-[#ded3c6] text-center transition hover:border-[#171d2b]">
              <span>
                <span className="block text-[22px] text-[#a99e8f]">＋</span>
                <span className="mt-1 block px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7f7469]">
                  Add photos
                </span>
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addImageFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      </Card>

      {/* Colours & variants */}
      <Card title="Colours & variants">
        <div className="space-y-5">
          {colors.map((color, ci) => (
            <div key={ci} className="rounded-xl border border-[#ece5da] p-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Colour name" className="flex-1 min-w-[160px]">
                  <input
                    className={inputClass}
                    value={color.colorName}
                    onChange={(e) => updateColor(ci, { colorName: e.target.value })}
                  />
                </Field>
                <Field label="Hex">
                  <input
                    type="color"
                    className="h-11 w-14 cursor-pointer rounded-lg border border-[#ded3c6] bg-white"
                    value={color.colorHex}
                    onChange={(e) => updateColor(ci, { colorHex: e.target.value })}
                  />
                </Field>
                {colors.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeColor(ci)}
                    className="h-11 rounded-lg border border-[#e6c4bb] px-3 text-[12px] font-semibold text-[#b83c24] hover:bg-[#fbeeea]"
                  >
                    Remove colour
                  </button>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-[1fr_1.4fr_0.8fr_auto] gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#958675]">
                  <span>Size</span>
                  <span>SKU</span>
                  <span>Stock</span>
                  <span />
                </div>
                {color.variants.map((v, vi) => (
                  <div key={vi} className="grid grid-cols-[1fr_1.4fr_0.8fr_auto] gap-2">
                    <input
                      className={inputClass}
                      placeholder="M"
                      value={v.size}
                      onChange={(e) => {
                        const size = e.target.value;
                        const suggestedSku =
                          !v.sku && color.colorName && size
                            ? `${makeSlugShort(draft.name)}-${makeSlugShort(color.colorName)}-${size.toUpperCase()}`
                            : v.sku;
                        updateVariant(ci, vi, { size, sku: suggestedSku });
                      }}
                    />
                    <input
                      className={`${inputClass} font-mono`}
                      placeholder="SKU"
                      value={v.sku}
                      onChange={(e) => updateVariant(ci, vi, { sku: e.target.value })}
                    />
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={v.stockQty}
                      onChange={(e) => updateVariant(ci, vi, { stockQty: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeVariant(ci, vi)}
                      disabled={color.variants.length === 1}
                      className="rounded-lg border border-[#ded3c6] px-3 text-[16px] leading-none text-[#8a8073] disabled:opacity-40"
                      title="Remove size"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addVariant(ci)}
                  className="mt-1 text-[12px] font-semibold text-[#806f5c] hover:text-[#171d2b]"
                >
                  + Add size
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addColor}
            className="rounded-xl border border-dashed border-[#ded3c6] px-4 py-2.5 text-[13px] font-semibold text-[#5f574e] hover:border-[#171d2b] hover:text-[#171d2b]"
          >
            + Add colour
          </button>
        </div>
      </Card>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ece5da] bg-white/95 backdrop-blur lg:left-[256px]">
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
          {error ? (
            <p role="alert" className="flex-1 truncate text-[13px] font-medium text-[#b83c24]">
              {error}
            </p>
          ) : (
            <span className="flex-1 text-[12px] text-[#958675]">
              {mode === "create" ? "New product" : "Editing product"}
            </span>
          )}
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => router.push("/catalogue")}
              className="rounded-full border border-[#ded3c6] px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#5f574e] hover:border-[#171d2b] hover:text-[#171d2b]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-[#171d2b] px-6 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-[#1f2a3c] disabled:opacity-60"
            >
              {saving ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-[#ded3c6] bg-white px-3 text-[14px] text-[#171d2b] outline-none transition focus:border-[#171d2b] focus:ring-4 focus:ring-[#ffd233]/25";

function makeSlugShort(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 6) || "sku";
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-[#ece5da] bg-white p-5 sm:p-6">
      <h2 className="text-[14px] font-semibold text-[#171d2b]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7f7469]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-[13px] font-medium text-[#171d2b]"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-[#2f7d46]" : "bg-[#d8d0c4]"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}
