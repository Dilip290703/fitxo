"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getStorageItem, setStorageItem } from "@/lib/storage";
import { WishlistToast } from "@/components/wishlist/WishlistToast";

const WISHLIST_STORAGE_KEY = "fitzo-wishlist";

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
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    setMounted(true);
    const stored = getStorageItem(WISHLIST_STORAGE_KEY);
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch {
        setItems([]);
      }
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setStorageItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  }, [items, mounted]);

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
