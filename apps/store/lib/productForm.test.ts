import { describe, expect, it } from "vitest";
import { emptyColor, emptyProductDraft, makeSlug, validate, type ColorDraft } from "./productForm";

function validDraft() {
  return { ...emptyProductDraft(), name: "Linen Shirt", basePrice: "1499" };
}

function validColors(): ColorDraft[] {
  return [
    {
      colorName: "Navy",
      colorHex: "#001133",
      variants: [{ size: "M", sku: "LIN-NAV-M", stockQty: "5" }],
    },
  ];
}

describe("validate", () => {
  it("passes a well-formed product", () => {
    expect(validate(validDraft(), validColors())).toBeNull();
  });
  it("requires a name", () => {
    expect(validate({ ...validDraft(), name: "  " }, validColors())).toMatch(/name/i);
  });
  it("requires a positive base price", () => {
    expect(validate({ ...validDraft(), basePrice: "0" }, validColors())).toMatch(/price/i);
    expect(validate({ ...validDraft(), basePrice: "abc" }, validColors())).toMatch(/price/i);
  });
  it("requires discounted price below base", () => {
    expect(validate({ ...validDraft(), discountedPrice: "1499" }, validColors())).toMatch(/below/i);
    expect(validate({ ...validDraft(), discountedPrice: "999" }, validColors())).toBeNull();
  });
  it("requires at least one named colour with a sized SKU", () => {
    expect(validate(validDraft(), [emptyColor()])).toMatch(/colour/i);
    const noVariant = [{ ...validColors()[0], variants: [{ size: "", sku: "", stockQty: "0" }] }];
    expect(validate(validDraft(), noVariant)).toMatch(/size|SKU/i);
  });
  it("rejects negative stock", () => {
    const bad = [{ ...validColors()[0], variants: [{ size: "M", sku: "X", stockQty: "-2" }] }];
    expect(validate(validDraft(), bad)).toMatch(/stock/i);
  });
});

describe("makeSlug", () => {
  it("slugifies with a random suffix", () => {
    const slug = makeSlug("Linen Shirt — Navy!");
    expect(slug).toMatch(/^linen-shirt-navy-[a-z0-9]{4}$/);
  });
  it("handles all-symbol names", () => {
    expect(makeSlug("!!!")).toMatch(/^product-[a-z0-9]{4}$/);
  });
});
