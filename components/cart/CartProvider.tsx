"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AddToBagDrawer } from "@/components/cart/AddToBagDrawer";

const CART_STORAGE_KEY = "fitzo-cart";

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
  const [mounted, setMounted] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    setMounted(true);

    const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);

    if (storedCart) {
      try {
        const parsed = JSON.parse(storedCart);

        if (Array.isArray(parsed)) {
          setItems(parsed);
        } else {
          setItems([]);
          window.localStorage.removeItem(CART_STORAGE_KEY);
        }
      } catch {
        setItems([]);
        window.localStorage.removeItem(CART_STORAGE_KEY);
      }
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    if (!mounted) return;

    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(items),
    );
  }, [items, mounted]);

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