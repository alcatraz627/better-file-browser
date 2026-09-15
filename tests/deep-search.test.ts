import { describe, it, expect } from 'vitest';
import { crawl, relativeName } from '../src/deep-search';
import type { Entry } from '../src/types';

const ROOT = 'file:///r/';

// A fake tree: key is the folder URL, value the names inside (trailing / = folder).
const TREE: Record<string, string[]> = {
  [ROOT]:                        ['a.txt', 'src/', '.git/', 'node_modules/', 'deep space/'],
  [ROOT + 'src/']:               ['main.ts', 'lib/'],
  [ROOT + 'src/lib/']:           ['util.ts', 'x/'],
  [ROOT + 'src/lib/x/']:         ['y/'],
  [ROOT + 'src/lib/x/y/']:       ['z.txt'],
  [ROOT + '.git/']:              ['HEAD'],
  [ROOT + 'node_modules/']:      ['pkg/'],
  [ROOT + 'deep%20space/']:      ['note.md'],
};

function entry(base: string, n: string): Entry {
  const isDir = n.endsWith('/');
  const name = isDir ? n.slice(0, -1) : n;
  return { name, href: base + encodeURIComponent(name) + (isDir ? '/' : ''), isDir, isParent: false,
           isHidden: name.startsWith('.'), rawBytes: isDir ? -1 : 3, dateMs: NaN, dateStr: '' };
}
const listDir = async (url: string): Promise<Entry[]> => {
  if (!(url in TREE)) throw new Error('missing ' + url);
  return TREE[url].map(n => entry(url, n));
};

describe('relativeName', () => {
  it('strips the root, decodes, and drops the folder slash', () => {
    expect(relativeName(ROOT + 'deep%20space/note.md', ROOT)).toBe('deep space/note.md');
    expect(relativeName(ROOT + 'src/lib/', ROOT)).toBe('src/lib');
  });
});

describe('crawl', () => {
  it('lists every entry with a root-relative name and skips vcs/vendor folders', async () => {
    const r = await crawl(ROOT, listDir);
    const names = r.entries.map(e => e.name).sort();
    expect(names).toEqual([
      '.git', 'a.txt', 'deep space', 'deep space/note.md', 'node_modules',
      'src', 'src/lib', 'src/lib/util.ts', 'src/lib/x', 'src/lib/x/y', 'src/lib/x/y/z.txt', 'src/main.ts',
    ]);
    expect(r.folders).toBe(6);          // root, src, src/lib, x, y, deep space
    expect(r.truncated).toBe(false);
    expect(r.cancelled).toBe(false);
  });

  it('marks entries under a dot-folder hidden and can descend into them', async () => {
    const r = await crawl(ROOT, listDir, { includeHidden: true, skipDirs: new Set(['node_modules']) });
    const head = r.entries.find(e => e.name === '.git/HEAD');
    expect(head?.isHidden).toBe(true);
  });

  it('honours the depth cap and reports truncation', async () => {
    const r = await crawl(ROOT, listDir, { maxDepth: 2 });
    expect(r.entries.some(e => e.name === 'src/lib/x')).toBe(true);
    expect(r.entries.some(e => e.name === 'src/lib/x/y')).toBe(false);
    expect(r.truncated).toBe(true);
  });

  it('stops at the entry cap', async () => {
    const r = await crawl(ROOT, listDir, { maxEntries: 3 });
    expect(r.entries.length).toBe(3);
    expect(r.truncated).toBe(true);
  });

  it('stops when cancelled and says so', async () => {
    let calls = 0;
    const r = await crawl(ROOT, listDir, {}, () => ++calls > 1);
    expect(r.cancelled).toBe(true);
    expect(r.entries.length).toBeLessThan(12);
  });

  it('reports progress as folders are listed', async () => {
    const seen: number[] = [];
    await crawl(ROOT, listDir, { onProgress: f => seen.push(f) });
    expect(seen[seen.length - 1]).toBe(6);
  });
});
