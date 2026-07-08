"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@fitzo/supabase/client";
import { AddToBagDrawer } from "@/components/cart/AddToBagDrawer";

/**
 * The bag is persisted PER SIGNED-IN USER, never globally.
 *
 * A logged-out visitor can still add to the bag, but that bag lives in memory
 * only: it is never written to storage and does not survive a reload. Signing
 * out empties the bag on the spot.
 *
 * Before this, a single global `fitzo-cart` key meant one browser's bag was
 * shared by every account that ever signed in on it, and it outlived sign-out.
 */
const cartStorageKey = (userId: string) => `fitzo-cart:${userId}`;

/** The old global key. Removed on first load so stale bags don't linger. */
const LEGACY_CART_KEY = "fitzo-cart";

export type CartItem = {
  key: string;
  id: string;
  title: string;
  brand: string;
  image: string;
  priceValue: number;
  displayPrice: string;
  displayOldPrice?: string;
  color: string;
  size: string;
  quantity: number;
};

type AddCartItemInput = Omit<CartItem, "key">;

type CartContextValue = {
  items: CartItem[];
  isDrawerOpen: boolean;
  latestItem: CartItem | null;
  addItem: (item: AddCartItemInput) => void;
  removeItem: (key: string) => void;
  moveToWishlist: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  subtotal: number;
  totalItems: number;
};

const CartContext = createContext<CartContextValue | null>(null);

function buildCartKey(item: AddCartItemInput) {
  return `${item.id}-${item.size}-${item.color}`;
}

export function CartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [latestItemKey, setLatestItemKey] = useState<string | null>(null);
  /** `undefined` = auth not resolved yet, `null` = signed out. */
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  /** Read the live bag inside auth callbacks without re-subscribing on it. */
  const itemsRef = useRef(items);
  itemsRef.current = items;

  /** Who the bag belonged to on the previous render of the effect below. */
  const previousUserId = useRef<string | null | undefined>(undefined);

  function readStoredCart(id: string): CartItem[] {
    try {
      const raw = window.localStorage.getItem(cartStorageKey(id));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      window.localStorage.removeItem(cartStorageKey(id));
      return [];
    }
  }

  // Track the session. Sign-in adopts whatever the guest added this session;
  // sign-out empties the bag.
  useEffect(() => {
    window.localStorage.removeItem(LEGACY_CART_KEY);

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

  // React to who the bag now belongs to.
  useEffect(() => {
    if (userId === undefined) return; // still resolving

    const wasSignedIn = typeof previousUserId.current === "string";
    previousUserId.current = userId;

    if (userId === null) {
      // Only a real sign-out empties the bag. The first resolve to `null` is
      // just "we now know you're a guest" — it must not wipe a bag the guest
      // added while auth was still in flight.
      if (wasSignedIn) setItems([]);
      return;
    }

    const stored = readStoredCart(userId);
    const guestItems = itemsRef.current;

    if (guestItems.length === 0) {
      setItems(stored);
      return;
    }

    // Merge the in-session guest bag into the user's stored bag.
    const merged = [...stored];
    for (const guestItem of guestItems) {
      const existing = merged.find((item) => item.key === guestItem.key);
      if (existing) {
        existing.quantity += guestItem.quantity;
      } else {
        merged.push(guestItem);
      }
    }
    setItems(merged);
  }, [userId]);

  // Persist only for a signed-in user.
  useEffect(() => {
    if (!userId) return;
    window.localStorage.setItem(cartStorageKey(userId), JSON.stringify(items));
  }, [items, userId]);

  const latestItem = useMemo(() => {
    if (!Array.isArray(items)) return null;

    if (!latestItemKey) {
      return items[items.length - 1] ?? null;
    }

    return items.find((item) => item.key === latestItemKey) ?? null;
  }, [items, latestItemKey]);

  const subtotal = useMemo(() => {
    if (!Array.isArray(items)) return 0;

    return items.reduce(
      (sum, item) => sum + item.priceValue * item.quantity,
      0,
    );
  }, [items]);

  const totalItems = useMemo(() => {
    if (!Array.isArray(items)) return 0;

    return items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      isDrawerOpen,
      latestItem,

      addItem: (item) => {
        const key = buildCartKey(item);

        setItems((current) => {
          const safeCurrent = Array.isArray(current)
            ? current
            : [];

          const existingItem = safeCurrent.find(
            (entry) => entry.key === key,
          );

          if (existingItem) {
            return safeCurrent.map((entry) =>
              entry.key === key
                ? {
                    ...entry,
                    quantity:
                      entry.quantity + item.quantity,
                  }
                : entry,
            );
          }

          return [...safeCurrent, { ...item, key }];
        });

        setLatestItemKey(key);
        setIsDrawerOpen(true);
      },

      removeItem: (key) => {
        setItems((current) =>
          Array.isArray(current)
            ? current.filter((item) => item.key !== key)
            : [],
        );

        setLatestItemKey((current) =>
          current === key ? null : current,
        );
      },

      moveToWishlist: (key) => {
        setItems((current) =>
          Array.isArray(current)
            ? current.filter((item) => item.key !== key)
            : [],
        );

        setLatestItemKey((current) =>
          current === key ? null : current,
        );
      },

      updateQuantity: (key, quantity) => {
        setItems((current) =>
          Array.isArray(current)
            ? current.map((item) =>
                item.key === key
                  ? {
                      ...item,
                      quantity: Math.max(1, quantity),
                    }
                  : item,
              )
            : [],
        );
      },

      clearCart: () => {
        setItems([]);
        setLatestItemKey(null);
      },

      openDrawer: () => setIsDrawerOpen(true),

      closeDrawer: () => setIsDrawerOpen(false),

      subtotal,
      totalItems,
    }),
    [items, isDrawerOpen, latestItem, subtotal, totalItems],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <AddToBagDrawer />
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart must be used within CartProvider",
    );
  }

  return context;
}