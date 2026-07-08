"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@fitzo/supabase/client";
import { getStorageItem, setStorageItem } from "@/lib/storage";
import { WishlistToast } from "@/components/wishlist/WishlistToast";

/**
 * Persisted PER SIGNED-IN USER, like the bag. A guest can still heart items
 * while browsing, but that list is in-memory only — it doesn't survive a
 * reload and empties on sign-out. The old global `fitzo-wishlist` key shared
 * one wishlist across every account on the browser; it is removed on load.
 */
const wishlistStorageKey = (userId: string) => `fitzo-wishlist:${userId}`;
const LEGACY_WISHLIST_KEY = "fitzo-wishlist";

export type WishlistItem = {
  id: string;
  title: string;
  brand: string;
  image: string;
  priceValue: number;
  displayPrice: string;
  displayOldPrice?: string;
  color?: string;
  size?: string;
  availability?: string;
};

type WishlistContextValue = {
  items: WishlistItem[];
  count: number;
  isWishlisted: (id: string) => boolean;
  toggleWishlist: (item: WishlistItem) => void;
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (id: string) => void;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  /** `undefined` = auth not resolved yet, `null` = signed out. */
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [toast, setToast] = useState("");

  // Track the session (same pattern as CartProvider).
  useEffect(() => {
    window.localStorage.removeItem(LEGACY_WISHLIST_KEY);

    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load the owner's wishlist; empty it when there is no owner.
  useEffect(() => {
    if (userId === undefined) return; // still resolving

    if (userId === null) {
      setItems([]);
      return;
    }

    const stored = getStorageItem(wishlistStorageKey(userId));
    if (!stored) {
      setItems([]);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setItems([]);
    }
  }, [userId]);

  // Persist only for a signed-in user.
  useEffect(() => {
    if (!userId) return;
    setStorageItem(wishlistStorageKey(userId), JSON.stringify(items));
  }, [items, userId]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }, []);

  const addToWishlist = useCallback(
    (item: WishlistItem) => {
      setItems((current) => {
        if (current.some((entry) => entry.id === item.id)) {
          return current;
        }
        return [...current, item];
      });
      showToast("Added to Wishlist");
    },
    [showToast],
  );

  const removeFromWishlist = useCallback(
    (id: string) => {
      setItems((current) => current.filter((item) => item.id !== id));
      showToast("Removed from Wishlist");
    },
    [showToast],
  );

  const toggleWishlist = useCallback(
    (item: WishlistItem) => {
      setItems((current) => {
        const exists = current.some((entry) => entry.id === item.id);
        if (exists) {
          showToast("Removed from Wishlist");
          return current.filter((entry) => entry.id !== item.id);
        }

        showToast("Added to Wishlist");
        return [...current, item];
      });
    },
    [showToast],
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      count: items.length,
      isWishlisted: (id: string) => items.some((item) => item.id === id),
      toggleWishlist,
      addToWishlist,
      removeFromWishlist,
    }),
    [items, toggleWishlist, addToWishlist, removeFromWishlist],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
      <WishlistToast message={toast} />
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);

  if (!context) {
    throw new Error("useWishlist must be used within WishlistProvider");
  }

  return context;
}
