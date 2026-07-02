import { describe, expect, it } from "vitest";
import { GST_RE, IFSC_RE, PAN_RE, PINCODE_RE } from "./onboarding";

// Client-side mirrors of the server-side checks in migration 029 — if these
// drift, the wizard lets through values the submit RPC/DB would store badly.

describe("PAN_RE", () => {
  it("accepts a valid PAN", () => {
    expect(PAN_RE.test("ABCDE1234F")).toBe(true);
  });
  it("rejects wrong shapes", () => {
    expect(PAN_RE.test("ABCDE1234")).toBe(false); // too short
    expect(PAN_RE.test("abcde1234f")).toBe(false); // lowercase (form uppercases first)
    expect(PAN_RE.test("1BCDE1234F")).toBe(false); // digit where letter expected
    expect(PAN_RE.test("ABCDE12345")).toBe(false); // digit where final letter expected
    expect(PAN_RE.test("")).toBe(false);
  });
});

describe("GST_RE", () => {
  it("accepts a valid GSTIN", () => {
    expect(GST_RE.test("22ABCDE1234F1Z5")).toBe(true);
  });
  it("rejects wrong shapes", () => {
    expect(GST_RE.test("22ABCDE1234F1X5")).toBe(false); // 14th char must be Z
    expect(GST_RE.test("2ABCDE1234F1Z5")).toBe(false); // 14 chars
    expect(GST_RE.test("22ABCDE1234F0Z5")).toBe(false); // entity code 0 invalid
    expect(GST_RE.test("")).toBe(false);
  });
});

describe("IFSC_RE", () => {
  it("accepts a valid IFSC", () => {
    expect(IFSC_RE.test("HDFC0001234")).toBe(true);
    expect(IFSC_RE.test("SBIN0ABC123")).toBe(true); // alphanumeric branch code
  });
  it("rejects wrong shapes", () => {
    expect(IFSC_RE.test("HDFC1001234")).toBe(false); // 5th char must be 0
    expect(IFSC_RE.test("HDF00001234")).toBe(false); // bank code must be 4 letters
    expect(IFSC_RE.test("HDFC000123")).toBe(false); // 10 chars
    expect(IFSC_RE.test("")).toBe(false);
  });
});

describe("PINCODE_RE", () => {
  it("accepts a valid pincode", () => {
    expect(PINCODE_RE.test("400001")).toBe(true);
  });
  it("rejects wrong shapes", () => {
    expect(PINCODE_RE.test("040001")).toBe(false); // can't start with 0
    expect(PINCODE_RE.test("4000011")).toBe(false); // 7 digits
    expect(PINCODE_RE.test("40001")).toBe(false); // 5 digits
    expect(PINCODE_RE.test("")).toBe(false);
  });
});
