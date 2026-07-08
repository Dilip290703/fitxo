import type { ProductDetailData } from '@/components/product/types';

// Supabase Storage base — used to normalise relative paths that were stored
// without the full public URL (e.g. "products/1780299776255.avif").
const SUPABASE_STORAGE_BASE =
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/product-images`;

/**
 * Ensures an image_url from the DB is always an absolute URL that
 * next/image (and browsers) can load.  Handles three cases:
 *  - already absolute  →  returned as-is
 *  - starts with "/"   →  local/public asset, returned as-is
 *  - relative path     →  prepended with the Supabase Storage public base
 *  - null / empty      →  returns ""
 */
function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return url;
  }
  // Relative storage path — reconstruct the full public URL
  return `${SUPABASE_STORAGE_BASE}/${url}`;
}

export type FrontendProduct = {
  id: string;
  title: string;
  brand: string;
  brandSlug: string;
  image: string;
  price: number;
  oldPrice: number;
  badge: string;
  orders: number;
  sizeLabel: string;
  /** Owning store — the store panel that will see an order for this product. */
  storeName: string;
};

export type FilterOption = {
  id: string;
  name: string;
  slug: string;
};

export type FilterOptions = {
  brands: FilterOption[];
  categories: FilterOption[];
  priceRange: [number, number];
};

export type FetchProductsParams = {
  brandIds?: string[];
  categoryIds?: string[];
  priceMin?: number;
  priceMax?: number;
  onlySale?: boolean;
  sortBy?: 'new-arrivals' | 'popular' | 'price-low' | 'price-high';
  page?: number;
  perPage?: number;
  searchQuery?: string;
  brandSlug?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickPrimaryImage(images: any[]): string {
  if (!images?.length) return '';
  const sorted = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const primary = sorted.find((img) => img.is_primary);
  return normalizeImageUrl((primary ?? sorted[0]).image_url);
}

export async function queryProducts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: FetchProductsParams = {},
): Promise<{ products: FrontendProduct[]; total: number }> {
  const {
    brandIds,
    categoryIds,
    priceMin,
    priceMax,
    onlySale,
    sortBy = 'new-arrivals',
    page = 1,
    perPage = 9,
    searchQuery,
    brandSlug,
  } = params;

  let query = supabase
    .from('products')
    .select(
      `id, name, slug, base_price, discounted_price, tags, created_at,
       brands(id, name, slug),
       stores(id, name),
       product_images(image_url, is_primary, sort_order),
       product_variants(id, size, available_qty, is_available)`,
      { count: 'exact' },
    )
    .eq('is_active', true)
    .eq('is_deleted', false);

  if (searchQuery?.trim()) query = query.ilike('name', `%${searchQuery.trim()}%`);
  // brandSlug: resolve to brand_id first so the filter is on the FK column, not a join
  if (brandSlug?.trim() && !brandIds?.length) {
    const { data: brandRow } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', brandSlug.trim())
      .single();
    if (brandRow?.id) query = query.eq('brand_id', brandRow.id);
    else return { products: [], total: 0 }; // unknown brand → no results
  }
  if (brandIds?.length) query = query.in('brand_id', brandIds);
  if (categoryIds?.length) query = query.in('category_id', categoryIds);
  if (priceMin != null) query = query.gte('base_price', priceMin);
  if (priceMax != null) query = query.lte('base_price', priceMax);
  if (onlySale) query = query.not('discounted_price', 'is', null);

  if (sortBy === 'price-low') query = query.order('base_price', { ascending: true });
  else if (sortBy === 'price-high') query = query.order('base_price', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const from = (page - 1) * perPage;
  query = query.range(from, from + perPage - 1);

  const { data, error, count } = await query;
  if (error || !data) return { products: [], total: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products: FrontendProduct[] = (data as any[]).map((row) => {
    const price = row.discounted_price ?? row.base_price;
    const oldPrice = row.discounted_price ? row.base_price : price;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstAvailableSize = (row.product_variants ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (v: any) => v.is_available && v.available_qty > 0,
    )?.size ?? 'M';

    return {
      id: row.id,
      title: row.name,
      brand: row.brands?.name ?? '',
      brandSlug: row.brands?.slug ?? '',
      image: pickPrimaryImage(row.product_images ?? []),
      price,
      oldPrice,
      badge: row.tags?.[0] ?? 'New Arrivals',
      orders: 0,
      sizeLabel: firstAvailableSize,
      storeName: row.stores?.name ?? '',
    };
  });

  return { products, total: count ?? 0 };
}

export async function queryCategoryIdsByGender(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  gender: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('gender', gender)
    .eq('is_active', true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((c: any) => c.id);
}

export async function queryFilterOptions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<FilterOptions> {
  const [brandsRes, categoriesRes, minRes, maxRes] = await Promise.all([
    supabase.from('brands').select('id, name, slug').eq('is_active', true).order('name'),
    supabase
      .from('categories')
      .select('id, name, slug')
      .eq('is_active', true)
      .is('parent_id', null)
      .order('sort_order'),
    supabase
      .from('products')
      .select('base_price')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('base_price', { ascending: true })
      .limit(1),
    supabase
      .from('products')
      .select('base_price')
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('base_price', { ascending: false })
      .limit(1),
  ]);

  return {
    brands: brandsRes.data ?? [],
    categories: categoriesRes.data ?? [],
    priceRange: [
      minRes.data?.[0]?.base_price ?? 0,
      maxRes.data?.[0]?.base_price ?? 10000,
    ],
  };
}

export async function queryProductDetail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  id: string,
): Promise<ProductDetailData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runQuery = async (field: string, value: string): Promise<any> => {
    const { data } = await supabase
      .from('products')
      .select(
        `id, name, slug, description, short_description, material, care_instructions,
         base_price, discounted_price, tags,
         brands(id, name, slug),
         stores(id, name),
         categories(id, name, slug, gender),
         product_images(id, image_url, angle, is_primary, sort_order, alt_text, color_id),
         product_colors(id, color_name, color_hex, is_available, sort_order),
         product_variants(id, size, size_type, stock_qty, available_qty, color_id, is_available)`,
      )
      .eq(field, value)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .maybeSingle();
    return data;
  };

  const row = (await runQuery('id', id)) ?? (await runQuery('slug', id));
  if (!row) return null;

  const price = row.discounted_price ?? row.base_price;
  const oldPrice = row.discounted_price ? row.base_price : null;
  const discountPct = oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedImages = [...(row.product_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
  const gallery = sortedImages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((img: any, i: number) => ({
      id: img.id ?? `img-${i}`,
      src: normalizeImageUrl(img.image_url),
      alt: img.alt_text ?? row.name,
    }))
    // Drop entries with no valid src — these crash next/image
    .filter((img) => img.src !== '');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedColors = [...(row.product_colors ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colors = sortedColors.filter((c: any) => c.is_available && c.color_name).map((c: any) => {
    const colorImages = sortedImages.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (img: any) => img.color_id === c.id,
    );
    // Use per-color image first, then fall back to first gallery image (never empty string)
    const preview =
      normalizeImageUrl(colorImages[0]?.image_url) || gallery[0]?.src || null;
    return {
      name: c.color_name as string,
      value: (c.color_hex as string) ?? '#000000',
      preview,
    };
  // Drop colors whose preview is null — they would crash ColorSelector's <Image>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).filter((c: any) => c.preview !== null) as { name: string; value: string; preview: string }[];

  // Build sizes: ALL variants with a valid size label, available ones first,
  // unavailable ones (sold-out/disabled) included so users see the full range.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Build sizes — all variants with a valid, non-null size label.
  // Available = in_stock AND available_qty > 0.
  // If a size appears in multiple variants, mark it available if ANY variant is available.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sizeMap = new Map<string, boolean>(); // label → available
  for (const v of row.product_variants ?? []) {
    const raw = v.size;
    if (raw === null || raw === undefined) continue;
    const label = String(raw).trim();
    if (!label) continue; // skip empty strings
    const isAvailable = Boolean(v.is_available && (v.available_qty ?? 0) > 0);
    if (!sizeMap.has(label) || isAvailable) {
      sizeMap.set(label, isAvailable);
    }
  }

  // Fallback: if no size variants are configured at all, use "Free Size" so the
  // product is still purchasable and Add to Bag is never permanently blocked.
  if (sizeMap.size === 0) {
    sizeMap.set('Free Size', true);
  }

  const sizes = Array.from(sizeMap.entries()).map(([label, available]) => ({
    label,
    available,
  }));

  const details: string[] = [];
  if (row.description) details.push(row.description as string);
  if (row.material) details.push(`Material: ${row.material}`);
  if (row.care_instructions) details.push(row.care_instructions as string);
  if (!details.length) {
    details.push('Premium quality garment for all-day comfort.');
    details.push('Doorstep try-on — hand back what you skip to the waiting rider.');
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    brand: row.brands?.name ?? '',
    storeName: row.stores?.name ?? '',
    priceValue: price,
    price: `₹${price}`,
    oldPriceValue: oldPrice ?? undefined,
    oldPrice: oldPrice ? `₹${oldPrice}` : undefined,
    discount: discountPct ? `${discountPct}% off` : undefined,
    subtitle:
      (row.short_description as string | null) ??
      'A FitZo pick designed for all-day comfort and doorstep try-on confidence.',
    gallery,
    colors,
    sizes,
    // No live coupon system is wired yet — advertising invented codes
    // (SHOP10/15) that fail at payment is worse than showing none.
    offers: [],
    // The store that actually fulfils this product. No geo data exists in the
    // DB, so no invented distances/ETAs — same call as the agent panel.
    nearbyStores: row.stores?.name ? [{ name: row.stores.name }] : [],
    reviews: [],
    details,
    delivery: [
      'Slot-based delivery from nearby partner stores.',
      'Try on at your door before you pay, with instant fit feedback.',
      'Live order tracking updates once the style is on the way.',
    ],
    returns: [
      'Hand it back to the rider on the spot if the fit is not right.',
      'Refunds are processed quickly for prepaid orders.',
      'Kept items are billed only after your try-on window closes.',
    ],
    recommendedIds: [],
  };
}

export async function queryFeaturedProducts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  limit = 4,
): Promise<FrontendProduct[]> {
  const { data } = await supabase
    .from('products')
    .select(
      `id, name, slug, base_price, discounted_price, tags, created_at,
       brands(id, name, slug),
       stores(id, name),
       product_images(image_url, is_primary, sort_order),
       product_variants(id, size, available_qty, is_available)`,
    )
    .eq('is_active', true)
    .eq('is_deleted', false)
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row) => {
    const price = row.discounted_price ?? row.base_price;
    const oldPrice = row.discounted_price ? row.base_price : price;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstAvailableSize = (row.product_variants ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (v: any) => v.is_available && v.available_qty > 0,
    )?.size ?? 'M';

    return {
      id: row.id,
      title: row.name,
      brand: row.brands?.name ?? '',
      brandSlug: row.brands?.slug ?? '',
      image: pickPrimaryImage(row.product_images ?? []),
      price,
      oldPrice,
      badge: row.tags?.[0] ?? 'Featured',
      orders: 0,
      sizeLabel: firstAvailableSize,
      storeName: row.stores?.name ?? '',
    };
  });
}

export async function queryRecommendedProducts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  currentId: string,
  brandId?: string,
  categoryId?: string,
  limit = 6,
): Promise<{ id: string; title: string; price: number; image: string }[]> {
  let query = supabase
    .from('products')
    .select(
      `id, name, base_price, discounted_price,
       product_images(image_url, is_primary, sort_order)`,
    )
    .eq('is_active', true)
    .eq('is_deleted', false)
    .neq('id', currentId)
    .limit(limit);

  if (brandId) query = query.eq('brand_id', brandId);
  else if (categoryId) query = query.eq('category_id', categoryId);

  const { data } = await query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.name,
    price: row.discounted_price ?? row.base_price,
    image: pickPrimaryImage(row.product_images ?? []),
  }));
}
