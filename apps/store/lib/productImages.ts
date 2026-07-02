import { createClient } from "@fitzo/supabase/client";

/**
 * One image tile in the ProductForm. Two flavours:
 *  - persisted: has `id` + `url` (a row in product_images)
 *  - pending:   has `file` + a local object-URL preview; uploaded on save
 * The array ORDER is the sort_order; exactly one image should be primary.
 */
export type ImageDraft = {
  id?: string;
  url: string;
  file?: File;
  isPrimary: boolean;
};

export const MAX_IMAGES = 8;
export const MAX_IMAGE_MB = 5;

const BUCKET = "product-images";

export async function loadProductImages(productId: string): Promise<ImageDraft[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("product_images")
    .select("id, image_url, is_primary, sort_order")
    .eq("product_id", productId)
    .order("sort_order");
  return (data ?? []).map((r) => ({
    id: r.id,
    url: r.image_url,
    isPrimary: r.is_primary ?? false,
  }));
}

/** Basic pre-upload checks; returns an error message or null. */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return `${file.name} isn't an image.`;
  if (file.size > MAX_IMAGE_MB * 1024 * 1024)
    return `${file.name} is over ${MAX_IMAGE_MB} MB — please compress it.`;
  return null;
}

/**
 * Reconcile the form's image list with the DB after the product row exists:
 * upload pending files ({storeId}/{productId}/… per migration 030's policies),
 * insert their rows, update kept rows' is_primary/sort_order, and delete
 * removed rows (+ their storage objects when they live in our bucket).
 */
export async function syncProductImages(
  productId: string,
  storeId: string,
  images: ImageDraft[],
  removed: ImageDraft[],
): Promise<void> {
  const supabase = createClient();

  // 1. Deletions first (rows, then best-effort storage cleanup).
  const removedIds = removed.map((r) => r.id).filter((id): id is string => !!id);
  if (removedIds.length > 0) {
    const { error } = await supabase.from("product_images").delete().in("id", removedIds);
    if (error) throw new Error(error.message);
    const paths = removed
      .map((r) => storagePathFromUrl(r.url))
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      // Best-effort: an orphaned file is harmless; a broken save is not.
      await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
    }
  }

  // 2. Upload pending files + upsert order/primary on everything kept.
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (img.file) {
      const ext = (img.file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${storeId}/${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, img.file, { contentType: img.file.type, upsert: false });
      if (upErr) throw new Error(friendlyStorageError(upErr.message));

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: insErr } = await supabase.from("product_images").insert({
        product_id: productId,
        image_url: pub.publicUrl,
        is_primary: img.isPrimary,
        sort_order: i,
        angle: "front",
      });
      if (insErr) throw new Error(insErr.message);
    } else if (img.id) {
      const { error } = await supabase
        .from("product_images")
        .update({ is_primary: img.isPrimary, sort_order: i })
        .eq("id", img.id);
      if (error) throw new Error(error.message);
    }
  }
}

/** Extract the object path from a public URL in our bucket (null for external URLs). */
function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : decodeURIComponent(url.slice(idx + marker.length));
}

function friendlyStorageError(message: string): string {
  if (/bucket.*not.*found/i.test(message))
    return "Image storage isn't set up yet — apply migration 030 (product-images bucket).";
  if (/row-level security|violates.*policy|Unauthorized/i.test(message))
    return "You don't have permission to upload images for this store (migration 030 needed?).";
  return message;
}
