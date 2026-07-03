import { createClient } from "@fitzo/supabase/client";

export type VariantDraft = {
  id?: string; // present = already persisted
  size: string;
  sku: string;
  stockQty: string; // kept as string for the input; parsed on save
};

export type ColorDraft = {
  id?: string;
  colorName: string;
  colorHex: string;
  variants: VariantDraft[];
};

export type ProductDraft = {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  material: string;
  careInstructions: string;
  fitType: string;
  categoryId: string;
  basePrice: string;
  discountedPrice: string;
  depositAmount: string;
  tags: string;
  isActive: boolean;
  isFeatured: boolean;
};

export const FIT_TYPES = ["slim", "regular", "oversized", "relaxed"] as const;

export function emptyVariant(): VariantDraft {
  return { size: "", sku: "", stockQty: "0" };
}

export function emptyColor(): ColorDraft {
  return { colorName: "", colorHex: "#111111", variants: [emptyVariant()] };
}

export function emptyProductDraft(): ProductDraft {
  return {
    name: "", slug: "", description: "", shortDescription: "", material: "",
    careInstructions: "", fitType: "", categoryId: "", basePrice: "",
    // New products start as DRAFTS (inactive) — the owner flips them live
    // deliberately, instead of a half-filled product hitting the storefront.
    discountedPrice: "", depositAmount: "0", tags: "", isActive: false, isFeatured: false,
  };
}

/** URL-safe slug + short random suffix to dodge the global-unique slug constraint. */
export function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `product-${suffix}`;
}

export type FormRefData = {
  categories: { id: string; name: string }[];
};

export async function loadFormRefData(): Promise<FormRefData> {
  const supabase = createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  return { categories: data ?? [] };
}

export type ProductForEdit = {
  draft: ProductDraft;
  colors: ColorDraft[];
};

/** Load an existing product (scoped to the store) into editable drafts. */
export async function loadProductForEdit(
  productId: string,
  storeId: string,
): Promise<ProductForEdit | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, store_id, name, slug, description, short_description, material, care_instructions, fit_type, category_id, base_price, discounted_price, deposit_amount, tags, is_active, is_featured, product_colors(id, color_name, color_hex, sort_order, product_variants(id, size, sku, stock_qty))",
    )
    .eq("id", productId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (error || !data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = data;
  const colors: ColorDraft[] = (p.product_colors ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c: any) => ({
      id: c.id,
      colorName: c.color_name ?? "",
      colorHex: c.color_hex ?? "#111111",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      variants: (c.product_variants ?? []).map((v: any) => ({
        id: v.id,
        size: v.size ?? "",
        sku: v.sku ?? "",
        stockQty: String(v.stock_qty ?? 0),
      })),
    }));

  return {
    draft: {
      name: p.name ?? "",
      slug: p.slug ?? "",
      description: p.description ?? "",
      shortDescription: p.short_description ?? "",
      material: p.material ?? "",
      careInstructions: p.care_instructions ?? "",
      fitType: p.fit_type ?? "",
      categoryId: p.category_id ?? "",
      basePrice: String(p.base_price ?? ""),
      discountedPrice: p.discounted_price == null ? "" : String(p.discounted_price),
      depositAmount: String(p.deposit_amount ?? "0"),
      tags: Array.isArray(p.tags) ? p.tags.join(", ") : "",
      isActive: p.is_active ?? true,
      isFeatured: p.is_featured ?? false,
    },
    colors: colors.length > 0 ? colors : [emptyColor()],
  };
}

export type ValidationError = { message: string };

function buildProductRow(draft: ProductDraft, storeId: string) {
  return {
    store_id: storeId,
    name: draft.name.trim(),
    slug: draft.slug.trim() || makeSlug(draft.name),
    description: draft.description.trim() || null,
    short_description: draft.shortDescription.trim() || null,
    material: draft.material.trim() || null,
    care_instructions: draft.careInstructions.trim() || null,
    fit_type: draft.fitType || null,
    category_id: draft.categoryId || null,
    base_price: parseFloat(draft.basePrice),
    discounted_price: draft.discountedPrice ? parseFloat(draft.discountedPrice) : null,
    deposit_amount: parseFloat(draft.depositAmount) || 0,
    tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
    is_active: draft.isActive,
    is_featured: draft.isFeatured,
  };
}

export type ProductFieldErrors = {
  name?: string;
  basePrice?: string;
  discountedPrice?: string;
  /** First colour/variant problem — shown on the colours card. */
  colors?: string;
};

/** Field-keyed validation for inline display. Empty object = valid. */
export function validateFields(draft: ProductDraft, colors: ColorDraft[]): ProductFieldErrors {
  const errors: ProductFieldErrors = {};
  if (!draft.name.trim()) errors.name = "Enter a product name.";
  const base = parseFloat(draft.basePrice);
  if (!Number.isFinite(base) || base <= 0) errors.basePrice = "Enter a valid base price.";
  if (draft.discountedPrice) {
    const disc = parseFloat(draft.discountedPrice);
    if (!Number.isFinite(disc) || disc < 0) errors.discountedPrice = "Discounted price is invalid.";
    else if (Number.isFinite(base) && disc >= base)
      errors.discountedPrice = "Discounted price must be below the base price.";
  }
  const realColors = colors.filter((c) => c.colorName.trim());
  if (realColors.length === 0) {
    errors.colors = "Add at least one colour.";
  } else {
    outer: for (const c of realColors) {
      const realVariants = c.variants.filter((v) => v.size.trim() && v.sku.trim());
      if (realVariants.length === 0) {
        errors.colors = `Colour "${c.colorName}" needs at least one size with a SKU.`;
        break;
      }
      for (const v of realVariants) {
        if (!Number.isFinite(parseInt(v.stockQty, 10)) || parseInt(v.stockQty, 10) < 0) {
          errors.colors = `Stock for ${c.colorName} / ${v.size} is invalid.`;
          break outer;
        }
      }
    }
  }
  return errors;
}

/** Returns a human-readable error string, or null if valid. */
export function validate(draft: ProductDraft, colors: ColorDraft[]): string | null {
  const e = validateFields(draft, colors);
  return e.name ?? e.basePrice ?? e.discountedPrice ?? e.colors ?? null;
}

async function insertColorsAndVariants(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  productId: string,
  colors: ColorDraft[],
) {
  for (let ci = 0; ci < colors.length; ci++) {
    const c = colors[ci];
    if (!c.colorName.trim()) continue;
    const { data: colorRow, error: colorErr } = await supabase
      .from("product_colors")
      .insert({
        product_id: productId,
        color_name: c.colorName.trim(),
        color_hex: c.colorHex || null,
        sort_order: ci,
      })
      .select("id")
      .single();
    if (colorErr) throw new Error(colorErr.message);

    const variantRows = c.variants
      .filter((v) => v.size.trim() && v.sku.trim())
      .map((v) => ({
        product_id: productId,
        color_id: colorRow.id,
        size: v.size.trim(),
        sku: v.sku.trim(),
        stock_qty: parseInt(v.stockQty, 10) || 0,
        size_type: "alpha",
      }));
    if (variantRows.length > 0) {
      const { error: varErr } = await supabase.from("product_variants").insert(variantRows);
      if (varErr) throw new Error(varErr.message);
    }
  }
}

/** Create a brand-new product with its colours + variants. Returns the new id. */
export async function createProductFull(
  storeId: string,
  draft: ProductDraft,
  colors: ColorDraft[],
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(buildProductRow(draft, storeId))
    .select("id")
    .single();
  if (error) throw new Error(friendlyDbError(error.message));

  try {
    await insertColorsAndVariants(supabase, data.id, colors);
  } catch (e) {
    // Never leave a half-created product behind — retrying "Create" would
    // otherwise duplicate it. Soft-delete the orphan row (invisible to the
    // catalogue and storefront) before surfacing the real error.
    await supabase
      .from("products")
      .update({ is_deleted: true, is_active: false })
      .eq("id", data.id);
    throw e instanceof Error ? new Error(friendlyDbError(e.message)) : e;
  }
  return data.id;
}

/**
 * Update an existing product. Existing variants are updated in place (never
 * deleted blindly, since order_items.variant_id is ON DELETE RESTRICT). New
 * colours/variants are inserted. Variants the user removed are hard-deleted when
 * possible, else soft-disabled (is_available=false, stock 0) so an ordered
 * variant is never destroyed.
 */
export async function updateProductFull(
  productId: string,
  storeId: string,
  draft: ProductDraft,
  colors: ColorDraft[],
  original: ColorDraft[],
): Promise<void> {
  const supabase = createClient();

  const row = buildProductRow(draft, storeId);
  // Don't rewrite store_id/slug on edit (slug stays stable; store_id is fixed).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { store_id: _s, slug: _slug, ...updatable } = row;
  const { error } = await supabase.from("products").update(updatable).eq("id", productId);
  if (error) throw new Error(friendlyDbError(error.message));

  const keptColorIds = new Set<string>();
  const keptVariantIds = new Set<string>();

  for (let ci = 0; ci < colors.length; ci++) {
    const c = colors[ci];
    if (!c.colorName.trim()) continue;

    let colorId = c.id;
    if (colorId) {
      keptColorIds.add(colorId);
      const { error: cErr } = await supabase
        .from("product_colors")
        .update({ color_name: c.colorName.trim(), color_hex: c.colorHex || null, sort_order: ci })
        .eq("id", colorId);
      if (cErr) throw new Error(cErr.message);
    } else {
      const { data: newColor, error: cErr } = await supabase
        .from("product_colors")
        .insert({ product_id: productId, color_name: c.colorName.trim(), color_hex: c.colorHex || null, sort_order: ci })
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      colorId = newColor.id;
    }

    for (const v of c.variants) {
      if (!v.size.trim() || !v.sku.trim()) continue;
      const stock = parseInt(v.stockQty, 10) || 0;
      if (v.id) {
        keptVariantIds.add(v.id);
        const { error: vErr } = await supabase
          .from("product_variants")
          .update({ size: v.size.trim(), sku: v.sku.trim(), stock_qty: stock, is_available: true })
          .eq("id", v.id);
        if (vErr) throw new Error(vErr.message);
      } else {
        const { error: vErr } = await supabase.from("product_variants").insert({
          product_id: productId,
          color_id: colorId,
          size: v.size.trim(),
          sku: v.sku.trim(),
          stock_qty: stock,
          size_type: "alpha",
        });
        if (vErr) throw new Error(vErr.message);
      }
    }
  }

  // Remove variants/colours the user dropped — RESTRICT-safe.
  const originalVariants = original.flatMap((c) => c.variants.filter((v) => v.id));
  for (const v of originalVariants) {
    if (v.id && !keptVariantIds.has(v.id)) {
      await deleteOrDisableVariant(supabase, v.id);
    }
  }
  for (const c of original) {
    if (c.id && !keptColorIds.has(c.id)) {
      // Disable its variants first (RESTRICT-safe), then try to delete the colour.
      for (const v of c.variants) {
        if (v.id) await deleteOrDisableVariant(supabase, v.id);
      }
      await supabase.from("product_colors").delete().eq("id", c.id);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteOrDisableVariant(supabase: any, variantId: string) {
  const { error } = await supabase.from("product_variants").delete().eq("id", variantId);
  if (error) {
    // Likely FK RESTRICT (variant has orders) — soft-disable instead.
    await supabase
      .from("product_variants")
      .update({ is_available: false, stock_qty: 0 })
      .eq("id", variantId);
  }
}

function friendlyDbError(message: string): string {
  if (/duplicate key/i.test(message) && /slug/i.test(message))
    return "That product slug is already taken — tweak the name or slug.";
  if (/duplicate key/i.test(message) && /sku/i.test(message))
    return "One of your SKUs is already used — SKUs must be unique.";
  return message;
}
