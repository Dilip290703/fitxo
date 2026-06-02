"use client";

/**
 * LocationStore — global pincode + delivery-availability state.
 *
 * Single place that reads/writes localStorage and derives DeliveryStatus.
 * Every component that needs pincode or availability info uses useLocation().
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getStorageItem, setStorageItem } from "@/lib/storage";
import { getDeliveryStatus, type DeliveryStatus } from "@/lib/pincode";

// Keeps the same key that was already used in mockData / BagPageView
export const PINCODE_STORAGE_KEY = "fitzo-pincode";

// ─── Context ──────────────────────────────────────────────────────────────────

type LocationContextValue = {
  /** Current 6-digit pincode, or "" if none saved yet. */
  selectedPincode: string;
  /** Derived delivery status — always in sync with selectedPincode. */
  deliveryStatus: DeliveryStatus;
  /**
   * True once the user has explicitly saved a valid 6-digit pincode.
   * Use this to distinguish "not yet checked" from "checked but unavailable".
   */
  hasChecked: boolean;
  /** Save a pincode globally (persists to localStorage). */
  setPincode: (pincode: string) => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [selectedPincode, setSelectedPincode] = useState<string>("");

  // Hydrate from localStorage once on mount (client-only)
  useEffect(() => {
    const stored = getStorageItem(PINCODE_STORAGE_KEY);
    if (stored && /^\d{6}$/.test(stored)) {
      setSelectedPincode(stored);
    }
  }, []);

  const setPincode = useCallback((pincode: string) => {
    const clean = pincode.trim();
    setSelectedPincode(clean);
    setStorageItem(PINCODE_STORAGE_KEY, clean);
  }, []);

  const deliveryStatus = useMemo<DeliveryStatus>(
    () => getDeliveryStatus(selectedPincode),
    [selectedPincode],
  );

  const hasChecked = /^\d{6}$/.test(selectedPincode);

  const value = useMemo<LocationContextValue>(
    () => ({ selectedPincode, deliveryStatus, setPincode, hasChecked }),
    [selectedPincode, deliveryStatus, setPincode, hasChecked],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocation() must be called inside <LocationProvider>.");
  }
  return ctx;
}
