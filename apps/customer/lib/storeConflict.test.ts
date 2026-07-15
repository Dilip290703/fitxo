import { describe, expect, it } from "vitest";
import { findStoreConflict } from "./storeConflict";

const storeA = { storeId: "store-a", storeName: "Little Stars" };
const storeB = { storeId: "store-b", storeName: "Denim Depot" };

describe("findStoreConflict", () => {
  it("allows adding to an empty bag", () => {
    expect(findStoreConflict([], storeA)).toBeNull();
  });

  it("allows adding more items from the same store", () => {
    expect(findStoreConflict([storeA], storeA)).toBeNull();
  });

  it("flags an item from a second store", () => {
    expect(findStoreConflict([storeA], storeB)).toEqual({
      currentStoreId: "store-a",
      currentStoreName: "Little Stars",
      newStoreName: "Denim Depot",
    });
  });

  it("judges by the first bag item that knows its store", () => {
    expect(findStoreConflict([{}, storeA], storeB)?.currentStoreName).toBe("Little Stars");
  });

  it("cannot judge legacy items without a storeId (server guard covers)", () => {
    expect(findStoreConflict([{}], storeB)).toBeNull();
    expect(findStoreConflict([storeA], {})).toBeNull();
  });

  it("falls back to friendly names when a store name is missing", () => {
    const conflict = findStoreConflict(
      [{ storeId: "store-a" }],
      { storeId: "store-b" },
    );
    expect(conflict?.currentStoreName).toBe("your current store");
    expect(conflict?.newStoreName).toBe("another store");
  });
});
