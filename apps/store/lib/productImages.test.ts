import { describe, expect, it } from "vitest";
import { MAX_IMAGE_MB, validateImageFile } from "./productImages";

function fakeFile(name: string, type: string, sizeBytes: number): File {
  const f = new File([""], name, { type });
  // File size is read-only and derived from contents; override for the test
  // instead of allocating a real multi-MB buffer.
  Object.defineProperty(f, "size", { value: sizeBytes });
  return f;
}

describe("validateImageFile", () => {
  it("accepts a normal image", () => {
    expect(validateImageFile(fakeFile("a.jpg", "image/jpeg", 1024 * 1024))).toBeNull();
    expect(validateImageFile(fakeFile("a.png", "image/png", 10))).toBeNull();
  });
  it("rejects non-images", () => {
    expect(validateImageFile(fakeFile("a.pdf", "application/pdf", 10))).toMatch(/isn't an image/i);
    expect(validateImageFile(fakeFile("a.mp4", "video/mp4", 10))).toMatch(/isn't an image/i);
  });
  it("rejects oversized files", () => {
    const over = fakeFile("big.jpg", "image/jpeg", (MAX_IMAGE_MB + 1) * 1024 * 1024);
    expect(validateImageFile(over)).toMatch(/over/i);
  });
  it("accepts exactly the limit", () => {
    const atLimit = fakeFile("edge.jpg", "image/jpeg", MAX_IMAGE_MB * 1024 * 1024);
    expect(validateImageFile(atLimit)).toBeNull();
  });
});
