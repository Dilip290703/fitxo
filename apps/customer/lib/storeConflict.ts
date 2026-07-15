/**
 * Single-store cart (G1) — pure conflict detection.
 *
 * A Fitzo order is fulfilled by ONE store: one rider picks up from one shop,
 * delivers, and waits at the door. Mixing stores in a bag would make the
 * 60-minute delivery + doorstep try-on physically impossible, so the bag
 * refuses items from a second store (the checkout server rejects them too).
 */

export type StoreRef = {
  storeId?: string;
  storeName?: string;
};

export type StoreConflict = {
  /** Store the bag already belongs to. */
  currentStoreId: string;
  currentStoreName: string;
  /** Store of the item that was refused. */
  newStoreName: string;
};

/**
 * Returns the conflict when `incoming` belongs to a different store than the
 * bag, else null. Items without a storeId (legacy carts / wishlist entries
 * saved before G1) can't be judged client-side — the placeOrder server check
 * is the real guard; this just powers the friendly popup.
 */
export function findStoreConflict(
  bagItems: StoreRef[],
  incoming: StoreRef,
): StoreConflict | null {
  if (!incoming.storeId) return null;

  const owner = bagItems.find((item) => item.storeId);
  if (!owner || owner.storeId === incoming.storeId) return null;

  return {
    currentStoreId: owner.storeId as string,
    currentStoreName: owner.storeName || "your current store",
    newStoreName: incoming.storeName || "another store",
  };
}
