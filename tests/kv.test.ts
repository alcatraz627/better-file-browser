import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// A stand-in for chrome.storage.local with the promise API and onChanged.
function fakeChrome(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  const listeners: ((c: Record<string, { newValue?: unknown }>, area: string) => void)[] = [];
  const local = {
    get: async () => ({ ...data }),
    set: async (items: Record<string, unknown>) => {
      Object.assign(data, items);
      const changes = Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { newValue: v }]));
      listeners.forEach(l => l(changes, 'local'));
    },
  };
  return { data, listeners, chrome: { storage: { local, onChanged: { addListener: (l: typeof listeners[number]) => listeners.push(l) } } } };
}

async function freshKv() {
  vi.resetModules();
  return import('../src/kv');
}

describe('kv store', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { delete (globalThis as { chrome?: unknown }).chrome; });

  it('falls back to localStorage without chrome.storage', async () => {
    const kv = await freshKv();
    await kv.loadKv();
    kv.kvSet('bfb-view', 'tiles');
    expect(localStorage.getItem('bfb-view')).toBe('tiles');
    expect(kv.kvGet('bfb-view')).toBe('tiles');
  });

  it('copies bfb- keys out of localStorage once and leaves the originals', async () => {
    localStorage.setItem('bfb-theme', 'light');
    localStorage.setItem('other-app', 'x');
    const f = fakeChrome({ 'bfb-strip-v2:abc': { state: {} } });
    (globalThis as { chrome?: unknown }).chrome = f.chrome;
    const kv = await freshKv();
    await kv.loadKv();
    expect(kv.kvGet('bfb-theme')).toBe('light');
    expect(f.data['bfb-theme']).toBe('light');
    expect(f.data['other-app']).toBeUndefined();
    expect(localStorage.getItem('bfb-theme')).toBe('light');
    expect(kv.kvKeys()).toEqual(['bfb-theme']);   // recovery copies are not settings

    // A second load does not copy again, so a later localStorage value is ignored.
    localStorage.setItem('bfb-theme', 'dark');
    const kv2 = await freshKv();
    await kv2.loadKv();
    expect(kv2.kvGet('bfb-theme')).toBe('light');
  });

  it('writes through to chrome.storage and picks up other tabs\' changes', async () => {
    const f = fakeChrome({ 'bfb-kv-migrated': '1' });
    (globalThis as { chrome?: unknown }).chrome = f.chrome;
    const kv = await freshKv();
    await kv.loadKv();
    kv.kvSet('bfb-zoom', '120');
    expect(f.data['bfb-zoom']).toBe('120');
    expect(localStorage.getItem('bfb-zoom')).toBeNull();
    f.listeners.forEach(l => l({ 'bfb-zoom': { newValue: '80' } }, 'local'));
    expect(kv.kvGet('bfb-zoom')).toBe('80');
    f.listeners.forEach(l => l({ 'bfb-zoom': {} }, 'local'));
    expect(kv.kvGet('bfb-zoom')).toBeNull();
  });
});
