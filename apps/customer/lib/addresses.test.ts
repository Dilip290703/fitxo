import { describe, expect, it } from "vitest";
import { emptyDraft, formatAddressLine, validateAddressDraft } from "./addresses";

const valid = {
  ...emptyDraft,
  fullName: "Jay Bidve",
  phone: "9876543210",
  line1: "12 Rose Villa",
  line2: "MG Road",
  landmark: "Café Goodluck",
  city: "Pune",
  pincode: "411001",
};

describe("validateAddressDraft", () => {
  it("passes a complete Pune address", () => {
    expect(validateAddressDraft(valid)).toEqual({});
  });

  it("requires name, phone, line1, city and pincode", () => {
    const errors = validateAddressDraft(emptyDraft);
    expect(Object.keys(errors).sort()).toEqual(["fullName", "line1", "phone", "pincode"]);
  });

  it("rejects a short or non-mobile phone", () => {
    expect(validateAddressDraft({ ...valid, phone: "12345" }).phone).toBeTruthy();
    expect(validateAddressDraft({ ...valid, phone: "1234567890" }).phone).toBeTruthy();
  });

  it("rejects a non-Pune pincode (serviceability gate)", () => {
    expect(validateAddressDraft({ ...valid, pincode: "400001" }).pincode).toMatch(/Pune/);
  });

  it("rejects a malformed pincode", () => {
    expect(validateAddressDraft({ ...valid, pincode: "41100" }).pincode).toBeTruthy();
  });
});

describe("formatAddressLine", () => {
  it("joins the parts and appends the pincode", () => {
    expect(
      formatAddressLine({ ...valid, id: "x", isDefault: false, state: "Maharashtra" }),
    ).toBe("12 Rose Villa, MG Road, near Café Goodluck, Pune — 411001");
  });

  it("skips empty optional parts", () => {
    expect(
      formatAddressLine({ ...valid, id: "x", isDefault: false, line2: "", landmark: "" }),
    ).toBe("12 Rose Villa, Pune — 411001");
  });
});
