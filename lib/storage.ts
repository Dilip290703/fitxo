/**
 * Safe localStorage helpers.
 *
 * Node.js 22+ exposes a global `localStorage` that can interfere with
 * Next.js server-side rendering.  These wrappers ensure we only ever
 * touch the *browser's* storage object, and they silently return `null`
 * (or no-op) when running on the server or if the API is unavailable.
 */

function isBrowserStorage(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined" &&
      typeof window.localStorage.getItem === "function"
    );
  } catch {
    return false;
  }
}

export function getStorageItem(key: string): string | null {
  if (!isBrowserStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStorageItem(key: string, value: string): void {
  if (!isBrowserStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage full or access denied – silently ignore
  }
}

export function removeStorageItem(key: string): void {
  if (!isBrowserStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // silently ignore
  }
}
