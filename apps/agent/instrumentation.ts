/**
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * Node.js v22+ ships a built-in Web Storage API (`globalThis.localStorage`),
 * but it only works when `--localstorage-file` points to a valid path.
 * Without that, the object exists yet its methods throw, which crashes
 * Next.js SSR for any code that touches `localStorage` during rendering
 * (e.g. @supabase/ssr's browser client detecting the global).
 *
 * We fix this by replacing the broken global with a no-op in-memory shim
 * so SSR can proceed without errors.
 */

export async function register() {
  if (typeof window === "undefined") {
    const store = new Map<string, string>();

    const shim: Storage = {
      get length() {
        return store.size;
      },
      clear() {
        store.clear();
      },
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      key(index: number) {
        return [...store.keys()][index] ?? null;
      },
      removeItem(key: string) {
        store.delete(key);
      },
      setItem(key: string, value: string) {
        store.set(key, String(value));
      },
    };

    (globalThis as Record<string, unknown>).localStorage = shim;
  }
}
