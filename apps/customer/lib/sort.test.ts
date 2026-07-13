import { describe, expect, it } from "vitest";
import { normalizeSort, SORT_OPTIONS } from "./sort";

describe("normalizeSort", () => {
  it("passes through every valid sort option", () => {
    for (const option of SORT_OPTIONS) {
      expect(normalizeSort(option)).toBe(option);
    }
  });

  it("falls back to new-arrivals for unknown values", () => {
    expect(normalizeSort("cheapest")).toBe("new-arrivals");
    expect(normalizeSort("")).toBe("new-arrivals");
    expect(normalizeSort("POPULAR")).toBe("new-arrivals");
  });

  it("falls back to new-arrivals when the param is absent", () => {
    expect(normalizeSort(undefined)).toBe("new-arrivals");
  });
});
