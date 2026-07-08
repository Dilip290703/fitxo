"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@fitzo/supabase/client";
import { AddToBagDrawer } from "@/components/cart/AddToBagDrawer";
import { LoginRequiredModal } from "@/components/cart/LoginRequiredModal";

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
  /**
   * Adds to the bag. Returns false (and opens the login modal) when there is
   * no session — the bag requires an account, so callers must not run their
   * "added!" side effects unless this returns true.
   */
  addItem: (item: AddCartItemInput) => boolean;
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

  /** Opens when a guest tries to add to the bag. */
  const [showLoginModal, setShowLoginModal] = useState(false);

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

  // Track the session. addItem refuses without one, so a guest can never
  // hold a bag: signed out means empty, signed in means that user's bag.
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

  // Load the owner's bag; empty it the moment there is no owner.
  useEffect(() => {
    if (userId === undefined) return; // still resolving
    setItems(userId === null ? [] : readStoredCart(userId));
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
        // The bag requires an account. No session (or auth still resolving):
        // don't add — ask the guest to log in instead.
        if (typeof userId !== "string") {
          setShowLoginModal(true);
          return false;
        }

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
        return true;
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
    [items, isDrawerOpen, latestItem, subtotal, totalItems, userId],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <AddToBagDrawer />
      <LoginRequiredModal
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message="Log in or create an account to add items to your bag — try-at-home orders need an account."
      />
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