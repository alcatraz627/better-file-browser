// jsdom here doesn't expose localStorage; provide a deterministic in-memory
// shim so storage.ts (and its tests) work without a configured document URL.
const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem:    (k: string) => (k in store ? store[k] : null),
  setItem:    (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
  clear:      () => { for (const k of Object.keys(store)) delete store[k]; },
  key:        (i: number) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length; },
} as Storage;
