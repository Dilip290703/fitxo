"use client";

import { useEffect, useRef, useState } from "react";
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
  validateFields,
  type ColorDraft,
  type ProductDraft,
  type ProductFieldErrors,
} from "@/lib/productForm";
import {
  MAX_IMAGES,
  loadProductImages,
  syncProductImages,
  validateImageFile,
  type ImageDraft,
} from "@/lib/productImages";
import { useStorePanel } from "@/components/panel/PanelContext";
import { useToast } from "@/components/ui/Toast";
import { Banner } from "@/components/ui/Banner";
import { BlockSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, inputClass } from "@/components/ui/FormField";

type Mode = "create" | "edit";

export function ProductForm({
  mode,
  productId,
}: {
  mode: Mode;
  productId?: string;
}) {
  const { storeId } = useStorePanel();
  const toast = useToast();
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
  const [fieldErrors, setFieldErrors] = useState<ProductFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const dragIdx = useRef<number | null>(null);

  // Unsaved changes must survive an accidental tab close / reload.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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

  const markDirty = () => {
    setDirty(true);
    setError("");
    setFieldErrors({});
  };

  const setField = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    markDirty();
  };

  // ---- colour / variant editing (all variant ops funnel through updateColor) ----
  const updateColor = (ci: number, patch: Partial<ColorDraft>) => {
    setColors((cs) => cs.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
    markDirty();
  };
  const addColor = () => {
    setColors((cs) => [...cs, emptyColor()]);
    markDirty();
  };
  const removeColor = (ci: number) => {
    setColors((cs) => (cs.length === 1 ? cs : cs.filter((_, i) => i !== ci)));
    markDirty();
  };
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
    markDirty();
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

  const removeImage = (idx: number) => {
    setImages((imgs) => {
      const target = imgs[idx];
      if (target.id) setRemovedImages((r) => [...r, target]);
      if (target.file) URL.revokeObjectURL(target.url);
      const rest = imgs.filter((_, i) => i !== idx);
      if (target.isPrimary && rest.length > 0) rest[0] = { ...rest[0], isPrimary: true };
      return rest;
    });
    markDirty();
  };

  const setPrimaryImage = (idx: number) => {
    setImages((imgs) => imgs.map((img, i) => ({ ...img, isPrimary: i === idx })));
    markDirty();
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    setImages((imgs) => {
      const j = idx + dir;
      if (j < 0 || j >= imgs.length) return imgs;
      const next = [...imgs];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    markDirty();
  };

  const dropImage = (to: number) => {
    const from = dragIdx.current;
    dragIdx.current = null;
    if (from === null || from === to) return;
    setImages((imgs) => {
      const next = [...imgs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    markDirty();
  };

  const handleSave = async () => {
    const errs = validateFields(draft, colors);
    if (errs.name || errs.basePrice || errs.discountedPrice || errs.colors) {
      setFieldErrors(errs);
      setError(errs.name ?? errs.basePrice ?? errs.discountedPrice ?? errs.colors ?? "");
      return;
    }
    setSaving(true);
    setError("");
    let savedId = productId;
    try {
      if (mode === "create") {
        savedId = await createProductFull(storeId, draft, colors);
      } else if (productId) {
        await updateProductFull(productId, storeId, draft, colors, original);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the product. Please try again.");
      setSaving(false);
      return;
    }

    if (savedId) {
      try {
        await syncProductImages(savedId, storeId, images, removedImages);
      } catch (e) {
        if (mode === "create") {
          // The product itself saved — do NOT let a retry of "Create" make a
          // duplicate. Continue on the edit screen, where images can be retried.
          setDirty(false);
          toast("Product saved, but images failed to upload — retry them here", "error");
          router.replace(`/catalogue/${savedId}/edit`);
          return;
        }
        setError(e instanceof Error ? e.message : "Couldn't upload the images. Please try again.");
        setSaving(false);
        return;
      }
    }

    setDirty(false);
    toast(
      mode === "create"
        ? draft.isActive
          ? "Product created and live"
          : "Draft saved — activate it when ready"
        : "Changes saved",
    );
    router.push("/catalogue");
    router.refresh();
  };

  if (loadingInitial) {
    return (
      <div className="mx-auto w-full max-w-[860px] px-5 py-8 sm:px-8 lg:py-10">
        <BlockSkeleton className="h-[420px]" />
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="px-6 py-10">
        <p className="text-[14px] text-danger">Product not found in your store.</p>
        <button
          onClick={() => router.push("/catalogue")}
          className="mt-4 rounded-full border border-ink px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink"
        >
          Back to catalogue
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Catalogue
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-ink sm:text-[32px]">
          {mode === "create" ? "Add product" : "Edit product"}
        </h1>
      </header>

      {/* Details */}
      <Card title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" className="sm:col-span-2" error={fieldErrors.name}>
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
                markDirty();
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
          <Field label="Base price (₹)" error={fieldErrors.basePrice}>
            <input
              className={inputClass}
              inputMode="decimal"
              value={draft.basePrice}
              onChange={(e) => setField("basePrice", e.target.value)}
            />
          </Field>
          <Field label="Discounted price (₹)" error={fieldErrors.discountedPrice}>
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
          <div className="sm:col-span-2">
            <div className="flex items-center gap-5">
              <Toggle
                label="Live on storefront"
                checked={draft.isActive}
                onChange={(v) => setField("isActive", v)}
              />
              <Toggle label="Featured" checked={draft.isFeatured} onChange={(v) => setField("isFeatured", v)} />
            </div>
            {!draft.isActive ? (
              <p className="mt-2 text-[12px] text-soft">
                Saved as a draft — customers won&apos;t see it until you turn this on.
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Images */}
      <Card title="Images">
        <p className="-mt-1 mb-4 text-[12px] leading-5 text-soft">
          Up to {MAX_IMAGES} photos. The ★ image is the cover customers see first — drag to reorder.
          {mode === "create" ? " Images upload when you create the product." : ""}
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <div
              key={img.id ?? img.url}
              draggable
              onDragStart={() => {
                dragIdx.current = i;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                dropImage(i);
              }}
              className={`group relative aspect-square cursor-grab overflow-hidden rounded-xl border active:cursor-grabbing ${
                img.isPrimary ? "border-accent ring-2 ring-accent/40" : "border-line"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              {img.file ? (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white">
                  New
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                <button
                  type="button"
                  onClick={() => setPrimaryImage(i)}
                  title={img.isPrimary ? "Cover image" : "Make cover"}
                  className={`grid h-7 w-7 place-items-center rounded-full text-[13px] ${
                    img.isPrimary ? "bg-accent text-ink" : "bg-white/25 text-white hover:bg-white/40"
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
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/25 text-[14px] text-white hover:bg-danger"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}

          {images.length < MAX_IMAGES ? (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-line-strong text-center transition hover:border-ink">
              <span>
                <span className="block text-[22px] text-faint">＋</span>
                <span className="mt-1 block px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-soft">
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
        {fieldErrors.colors ? (
          <Banner variant="error" className="mb-4">{fieldErrors.colors}</Banner>
        ) : null}
        <div className="space-y-5">
          {colors.map((color, ci) => (
            <div key={ci} className="rounded-xl border border-line p-4">
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
                    className="h-11 w-14 cursor-pointer rounded-lg border border-line-strong bg-white"
                    value={color.colorHex}
                    onChange={(e) => updateColor(ci, { colorHex: e.target.value })}
                  />
                </Field>
                {colors.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeColor(ci)}
                    className="h-11 rounded-lg border border-danger-line px-3 text-[12px] font-semibold text-danger hover:bg-danger-bg"
                  >
                    Remove colour
                  </button>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-[1fr_1.4fr_0.8fr_auto] gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
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
                      className="rounded-lg border border-line-strong px-3 text-[16px] leading-none text-soft disabled:opacity-40"
                      title="Remove size"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addVariant(ci)}
                  className="mt-1 text-[12px] font-semibold text-soft hover:text-ink"
                >
                  + Add size
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addColor}
            className="rounded-xl border border-dashed border-line-strong px-4 py-2.5 text-[13px] font-semibold text-body hover:border-ink hover:text-ink"
          >
            + Add colour
          </button>
        </div>
      </Card>

      {/* Sticky save bar — sticks to the viewport bottom while the form scrolls,
          without hardcoding the sidebar width (it collapses now). */}
      <div className="sticky bottom-0 z-40 -mx-5 mt-6 border-t border-line bg-white/95 backdrop-blur sm:-mx-8">
        <div className="flex items-center justify-between gap-4 px-5 py-3 sm:px-8">
          {error ? (
            <p role="alert" className="flex-1 truncate text-[13px] font-medium text-danger">
              {error}
            </p>
          ) : (
            <span className="flex-1 text-[12px] text-muted">
              {mode === "create" ? "New product" : "Editing product"}
            </span>
          )}
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => (dirty ? setShowDiscard(true) : router.push("/catalogue"))}
              className="rounded-full border border-line-strong px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-body hover:border-ink hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-ink px-6 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-ink-soft disabled:opacity-60"
            >
              {saving ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {showDiscard ? (
        <ConfirmDialog
          title="Discard changes?"
          body="You have unsaved changes — they'll be lost if you leave now."
          confirmLabel="Discard"
          onConfirm={() => router.push("/catalogue")}
          onCancel={() => setShowDiscard(false)}
        />
      ) : null}
    </div>
  );
}

function makeSlugShort(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 6) || "sku";
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
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
      className="flex items-center gap-2 text-[13px] font-medium text-ink"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-success" : "bg-knob"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}
