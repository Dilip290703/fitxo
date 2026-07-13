"use client";

import { useEffect, useState } from "react";
import { createClient } from "@fitzo/supabase/client";
import { queryProducts } from "@/lib/supabase/products";

export type LiveRecommendation = {
  id: string;
  title: string;
  price: number;
  image: string;
  oldPrice?: number;
};

/**
 * Live "you may also like" products for the bag drawer / bag page.
 *
 * Replaces the mockData `catalogProducts` recommendations, whose
 * `/product/catalog-look-N` links all 404'd — every product a customer was
 * "recommended" led to an error page. These come from the same catalogue the
 * rest of the storefront sells from.
 *
 * `exclude` keeps items already in the bag out of the strip.
 */
export function useLiveRecommendations(count: number, exclude: string[] = []) {
  const [products, setProducts] = useState<LiveRecommendation[]>([]);
  const excludeKey = exclude.join(",");

  useEffect(() => {
    let cancelled = false;

    const supabase = createClient();
    queryProducts(supabase, {
      // Over-fetch a little so exclusions don't leave the strip short.
      perPage: count + exclude.length,
      sortBy: "popular",
    })
      .then(({ products: rows }) => {
        if (cancelled) return;
        const excluded = new Set(exclude);
        setProducts(
          rows
            // No photo, no card — next/image requires a src, and a blank tile
            // sells nothing anyway.
            .filter((row) => row.image && !excluded.has(row.id))
            .slice(0, count)
            .map((row) => ({
              id: row.id,
              title: row.title,
              price: row.price,
              image: row.image,
              oldPrice: row.oldPrice > row.price ? row.oldPrice : undefined,
            })),
        );
      })
      .catch(() => {
        // Recommendations are decoration — a failed fetch just hides the strip.
        if (!cancelled) setProducts([]);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, excludeKey]);

  return products;
}
