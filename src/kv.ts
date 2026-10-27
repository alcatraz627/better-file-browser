// Where the explorer keeps its settings, Saved folders and reading choices.
// Values live in chrome.storage.local so every folder sees the same ones;
// Firefox gives each file:// page its own localStorage, which would split them
// per folder. Reads stay synchronous through an in-memory copy that loadKv()
// fills before the page renders, and other tabs' writes flow back in.
//
// Without chrome.storage (unit tests, or a page whose extension was reloaded)
// the same calls fall through to localStorage.

const MIGRATED = 'bfb-kv-migrated';
// Tab-strip recovery copies share the bfb- prefix but hold objects; they are
// not settings and stay out of the cache and exports.
const NOT_KV = 'bfb-strip-v2:';

const cache = new Map<string, string>();
// Values this tab wrote whose change events have not come back yet, oldest
// first. Two quick writes to one key echo back in order; comparing each echo
// with the cache would mistake the first for another tab's write and roll the
// value back until the second arrives.
const pending = new Map<string, string[]>();
let area: chrome.storage.StorageArea | null = null;
const watchers: ((key: string) => void)[] = [];

// Call fn with the key whenever another tab changes a value.
export function onKvChange(fn: (key: string) => void): void {
  watchers.push(fn);
  if (!area) window.addEventListener('storage', e => { if (e.key && isKvKey(e.key)) fn(e.key); });
}

const isKvKey = (k: string) => k.startsWith('bfb-') && !k.startsWith(NOT_KV) && k !== MIGRATED;

function chromeArea(): chrome.storage.StorageArea | null {
  try { return (typeof chrome !== 'undefined' && chrome.storage?.local) || null; }
  catch { return null; }
}

function localKeys(): string[] {
  const out: string[] = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isKvKey(k)) out.push(k); } }
  catch { /* storage disabled */ }
  return out;
}

// Fill the cache. The first run on a profile copies this origin's bfb- keys
// out of localStorage; the old copies stay put so a rollback loses nothing.
export async function loadKv(): Promise<void> {
  const a = chromeArea();
  if (!a) return;
  let all: Record<string, unknown>;
  try { all = await a.get(null); }
  catch { return; }
  area = a;
  cache.clear();
  for (const [k, v] of Object.entries(all)) if (isKvKey(k) && typeof v === 'string') cache.set(k, v);
  if (!all[MIGRATED]) {
    const moved: Record<string, string> = { [MIGRATED]: '1' };
    for (const k of localKeys()) {
      if (cache.has(k)) continue;
      const v = localStorage.getItem(k);
      if (v !== null) { cache.set(k, v); moved[k] = v; }
    }
    try { await a.set(moved); } catch { /* context gone; the cache still serves this page */ }
  }
  chrome.storage.onChanged.addListener((changes, name) => {
    if (name !== 'local') return;
    for (const [k, c] of Object.entries(changes)) {
      if (!isKvKey(k)) continue;
      const mine = pending.get(k);
      const at = mine?.indexOf(c.newValue as string) ?? -1;
      if (mine && at >= 0) {   // this tab's own write
        mine.splice(0, at + 1);
        if (!mine.length) pending.delete(k);
        continue;
      }
      if (typeof c.newValue === 'string') cache.set(k, c.newValue);
      else cache.delete(k);
      watchers.forEach(fn => fn(k));
    }
  });
}

export function kvGet(key: string): string | null {
  if (!area) { try { return localStorage.getItem(key); } catch { return null; } }
  return cache.get(key) ?? null;
}

export function kvSet(key: string, value: string): void {
  if (!area) { try { localStorage.setItem(key, value); } catch { /* storage full or disabled */ } return; }
  // Writing what is already stored raises no change event, so nothing waits for one.
  if (cache.get(key) === value) return;
  cache.set(key, value);
  pending.set(key, [...(pending.get(key) ?? []), value]);
  const lost = () => pending.delete(key);
  try { track(area.set({ [key]: value }).catch(lost)); } catch { lost(); /* extension reloaded under the page */ }
}

// Writes on their way to storage, so a page about to reload can wait for them.
const inFlight = new Set<Promise<unknown>>();
function track(p: Promise<unknown>): void {
  inFlight.add(p);
  void p.finally(() => inFlight.delete(p));
}

/** Resolves once every write and removal this page started has reached storage. Call it before reloading. */
export async function kvFlush(): Promise<void> {
  while (inFlight.size) await Promise.allSettled([...inFlight]);
}

// Every settings key currently held, for export.
export function kvKeys(): string[] {
  return area ? [...cache.keys()] : localKeys();
}

// Forget a key everywhere, so it reads as never set.
export function kvRemove(key: string): void {
  if (!area) { try { localStorage.removeItem(key); } catch { /* storage disabled */ } return; }
  if (!cache.has(key)) return;
  cache.delete(key);
  try { track(area.remove(key).catch(() => { /* extension reloaded under the page */ })); } catch { /* extension reloaded under the page */ }
}
