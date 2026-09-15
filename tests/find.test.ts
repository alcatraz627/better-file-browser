import { describe, it, expect } from 'vitest';
import { EMPTY_FIND, isEmptyFind, parseExts, matchesFind, isTextCandidate, searchContents, findToHash, findFromHash, describeFind, isViewPath } from '../src/find';
import type { Entry } from '../src/types';

const f = (name: string, bytes = 10, isDir = false): Entry =>
  ({ name, href: 'file:///r/' + name, isDir, isParent: false, isHidden: false, rawBytes: bytes, dateMs: NaN, dateStr: '' });

describe('find query', () => {
  it('parses extensions and detects an empty query', () => {
    expect(parseExts(' .md, *.TS ts ')).toEqual(['md', 'ts']);
    expect(isEmptyFind(EMPTY_FIND)).toBe(true);
    expect(isEmptyFind({ ...EMPTY_FIND, scope: 'deep' })).toBe(false);
  });
  it('matches by name (substring or regex) and extension', () => {
    expect(matchesFind(f('Main.ts'), { ...EMPTY_FIND, name: 'main' })).toBe(true);
    expect(matchesFind(f('Main.ts'), { ...EMPTY_FIND, name: 'main', caseSensitive: true })).toBe(false);
    expect(matchesFind(f('Main.ts'), { ...EMPTY_FIND, name: '^ma.*ts$', regex: true })).toBe(true);
    expect(matchesFind(f('Main.ts'), { ...EMPTY_FIND, name: '(', regex: true })).toBe(false);
    expect(matchesFind(f('a.md'), { ...EMPTY_FIND, exts: ['ts'] })).toBe(false);
    expect(matchesFind(f('a.md'), { ...EMPTY_FIND, exts: ['md'] })).toBe(true);
  });
  it('picks text candidates by type and size', () => {
    expect(isTextCandidate(f('a.md'))).toBe(true);
    expect(isTextCandidate(f('a.png'))).toBe(false);
    expect(isTextCandidate(f('big.txt', 3 * 1024 * 1024))).toBe(false);
    expect(isTextCandidate(f('dir', -1, true))).toBe(false);
  });
});

describe('searchContents', () => {
  const docs: Record<string, string> = {
    'file:///r/a.md': 'Hello\nworld hello\n',
    'file:///r/b.txt': 'nothing here\n',
    'file:///r/c.txt': 'boom',
  };
  const read = async (h: string) => { if (h.endsWith('c.txt')) throw new Error('nope'); return docs[h]; };
  it('counts matches, keeps the first matching line, reports progress and failures', async () => {
    const seen: number[] = [];
    const r = await searchContents([f('a.md'), f('b.txt'), f('c.txt')], read, { ...EMPTY_FIND, text: 'hello' }, d => seen.push(d));
    expect(r.hits.get('file:///r/a.md')).toEqual({ count: 2, line: 'Hello' });
    expect(r.hits.has('file:///r/b.txt')).toBe(false);
    expect(r.failed).toBe(1);
    expect(r.scanned).toBe(3);
    expect(seen[seen.length - 1]).toBe(3);
  });
  it('respects case sensitivity and cancellation', async () => {
    const r = await searchContents([f('a.md')], read, { ...EMPTY_FIND, text: 'hello', caseSensitive: true });
    expect(r.hits.get('file:///r/a.md')?.count).toBe(1);
    const c = await searchContents([f('a.md'), f('b.txt')], read, { ...EMPTY_FIND, text: 'x' }, undefined, () => true);
    expect(c.cancelled).toBe(true);
    expect(c.scanned).toBe(0);
  });
});

describe('saved view hash', () => {
  it('round-trips a query through the hash and labels it', () => {
    const q = { ...EMPTY_FIND, scope: 'deep' as const, name: 'plan', exts: ['md'], text: 'todo' };
    const h = findToHash(q);
    expect(isViewPath('/x/' + h)).toBe(true);
    expect(findFromHash(h)).toEqual(q);
    expect(findToHash(EMPTY_FIND)).toBe('');
    expect(findFromHash('#other')).toBeNull();
    expect(describeFind(q)).toBe('plan .md "todo" in subfolders');
    expect(describeFind(EMPTY_FIND)).toBe('everything');
  });
});
