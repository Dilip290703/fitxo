'use server';

import { createClient } from '@fitzo/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/require-admin';
import { logActivity } from '@/lib/activity';

interface VariantInput {
  size: string;
  sku: string;
  stock_qty: number;
}

interface ColorInput {
  color_name: string;
  color_hex: string;
  variants: VariantInput[];
}

interface ProductPayload {
  name: string;
  slug: string;
  store_id: string;
  brand_id: string | null;
  category_id: string | null;
  description: string | null;
  short_description: string | null;
  material: string | null;
  care_instructions: string | null;
  fit_type: string | null;
  tags: string[];
  base_price: number;
  discounted_price: number | null;
  deposit_amount: number;
  is_featured: boolean;
  is_active: boolean;
  is_deleted: boolean;
}

export async function createProduct(
  payload: ProductPayload,
  colors: ColorInput[],
  imageUrls: string[],
): Promise<string> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  const productId = data.id as string;

  for (const color of colors) {
    const { data: colorData, error: colorErr } = await supabase
      .from('product_colors')
      .insert({ product_id: productId, color_name: color.color_name, color_hex: color.color_hex, sort_order: 0 })
      .select('id')
      .single();
    if (colorErr) throw new Error(colorErr.message);

    for (const v of color.variants) {
      const { error: varErr } = await supabase.from('product_variants').insert({
        product_id: productId,
        color_id: colorData.id,
        size: v.size,
        sku: v.sku,
        stock_qty: v.stock_qty,
        size_type: 'alpha',
      });
      if (varErr) throw new Error(varErr.message);
    }
  }

  for (let i = 0; i < imageUrls.length; i++) {
    const { error: imgErr } = await supabase.from('product_images').insert({
      product_id: productId,
      image_url: imageUrls[i],
      angle: 'front',
      is_primary: i === 0,
      sort_order: i,
    });
    if (imgErr) throw new Error(imgErr.message);
  }

  const ssr = await createClient();
  await logActivity(ssr, { action: 'Created product', entity_type: 'product', entity_id: productId, new_value: { name: payload.name } });

  return productId;
}

export async function updateProduct(
  productId: string,
  payload: ProductPayload,
  colors: ColorInput[],
  imageUrls: string[],
): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', productId);

  if (error) throw new Error(error.message);

  if (colors.length > 0) {
    await supabase.from('product_colors').delete().eq('product_id', productId);

    for (const color of colors) {
      const { data: colorData, error: colorErr } = await supabase
        .from('product_colors')
        .insert({ product_id: productId, color_name: color.color_name, color_hex: color.color_hex, sort_order: 0 })
        .select('id')
        .single();
      if (colorErr) throw new Error(colorErr.message);

      for (const v of color.variants) {
        const { error: varErr } = await supabase.from('product_variants').insert({
          product_id: productId,
          color_id: colorData.id,
          size: v.size,
          sku: v.sku,
          stock_qty: v.stock_qty,
          size_type: 'alpha',
        });
        if (varErr) throw new Error(varErr.message);
      }
    }
  }

  if (imageUrls.length > 0) {
    await supabase.from('product_images').delete().eq('product_id', productId);

    for (let i = 0; i < imageUrls.length; i++) {
      const { error: imgErr } = await supabase.from('product_images').insert({
        product_id: productId,
        image_url: imageUrls[i],
        angle: 'front',
        is_primary: i === 0,
        sort_order: i,
      });
      if (imgErr) throw new Error(imgErr.message);
    }
  }

  const ssr = await createClient();
  await logActivity(ssr, { action: 'Updated product', entity_type: 'product', entity_id: productId, new_value: { name: payload.name } });
}
