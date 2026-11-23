// Stores that two pages, two tabs or a damaged value can reach at once.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type Change = Record<string, { newValue?: unknown }>;
// chrome.storage.local shared by several pages. A write lands at once; its
// change event waits in `events` until the test delivers it, as Chrome's does.
function sharedChrome(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { 'bfb-kv-migrated': '1', ...initial };
  const listeners: ((c: Change, area: string) => void)[] = [];
  const events: Change[] = [];
  const local = {
    get: async () => ({ ...data }),
    set: async (items: Record<string, unknown>) => {
      Object.assign(data, items);
      events.push(Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { newValue: v }])));
    },
  };
  const deliver = () => { while (events.length) { const e = events.shift()!; listeners.forEach(l => l(e, 'local')); } };
  return { data, deliver, chrome: { storage: { local, onChanged: { addListener: (l: typeof listeners[number]) => listeners.push(l) } } } };
}
async function page() {
  vi.resetModules();
  const kv = await import('../src/kv');
  const storage = await import('../src/storage');
  await kv.loadKv();
  return { kv, storage };
}

describe('two pages on one store', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { delete (globalThis as { chrome?: unknown }).chrome; });

  it('a tab keeps its own value when another tab\'s write landed just before it', async () => {
    const f = sharedChrome();
    (globalThis as { chrome?: unknown }).chrome = f.chrome;
    const a = await page();
    const b = await page();
    b.kv.kvSet('bfb-view', 'tiles');
    a.kv.kvSet('bfb-view', 'list');
    f.deliver();
    expect(f.data['bfb-view']).toBe('list');
    expect(a.kv.kvGet('bfb-view')).toBe('list');
    expect(b.kv.kvGet('bfb-view')).toBe('list');
  });

  it('two pages that load together both stay in history', async () => {
    const f = sharedChrome({ 'bfb-recents-v1': JSON.stringify([{ path: '/old', ts: 1 }]) });
    (globalThis as { chrome?: unknown }).chrome = f.chrome;
    const a = await page();
    const b = await page();
    a.storage.pushRecent('/a');
    b.storage.pushRecent('/b');
    f.deliver();
    const stored = JSON.parse(f.data['bfb-recents-v1'] as string).map((r: { path: string }) => r.path).sort();
    expect(stored).toEqual(['/a', '/b', '/old']);
    expect(a.storage.getRecents().map(r => r.path).sort()).toEqual(['/a', '/b', '/old']);
    expect(b.storage.getRecents().map(r => r.path).sort()).toEqual(['/a', '/b', '/old']);
  });

  it('a visit forgotten later in another tab stays forgotten', async () => {
    const f = sharedChrome();
    (globalThis as { chrome?: unknown }).chrome = f.chrome;
    const a = await page();
    const b = await page();
    vi.useFakeTimers();
    try {
      a.storage.pushRecent('/a');
      f.deliver();
      vi.advanceTimersByTime(6000);
      b.storage.forgetRecent('/a');
      f.deliver();
      expect(JSON.parse(f.data['bfb-recents-v1'] as string)).toEqual([]);
    } finally { vi.useRealTimers(); }
  });
});

describe('damaged stored values', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });

  it('one bad row in the per-folder views does not cost the other folders', async () => {
    localStorage.setItem('bfb-folder-views-v1', JSON.stringify({ '/a': { view: 'tiles' }, '/b': 5 }));
    const fv = await import('../src/folder-views');
    expect(fv.folderView('/a')).toEqual({ view: 'tiles' });
    fv.keepFolderView('/c', { view: 'list' });
    expect(Object.keys(fv.allFolderViews()).sort()).toEqual(['/a', '/c']);
  });

  it('the kept notes list drops rows it could not draw', async () => {
    const { keptNotesList } = await import('../src/storage');
    localStorage.setItem('bfbNotesKept', JSON.stringify({ root: '/n', notes: [null, 5, { rel: 7 }, { rel: 'a.md', tags: 'x' }, { rel: 'b.md', tags: [1] }, { rel: 'ok.md', tags: ['t'] }, { rel: 'plain.md' }] }));
    expect(keptNotesList<{ rel: string }>('/n')!.map(n => n.rel)).toEqual(['ok.md', 'plain.md']);
    expect(keptNotesList('/other')).toBeNull();
  });
});
