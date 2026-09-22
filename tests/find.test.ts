import { describe, it, expect } from 'vitest';
import { EMPTY_FIND, isEmptyFind, parseExts, matchesFind, isTextCandidate, searchContents, scanContent, textPatternError, findToHash, findFromHash, describeFind, isViewPath } from '../src/find';
import { renderHitSnippet } from '../src/render';
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
    expect(r.hits.get('file:///r/a.md')).toEqual({ count: 2, line: 'Hello', start: 0, end: 5, lineNumber: 1 });
    expect(r.hits.has('file:///r/b.txt')).toBe(false);
    expect(r.failed).toBe(1);
    expect(r.scanned).toBe(3);
    expect(seen[seen.length - 1]).toBe(3);
  });
  it('bounds and escapes a first-match snippet without losing its highlighted span', () => {
    const hit = scanContent('prefix '.repeat(40) + '<script> & "needle" tail', { ...EMPTY_FIND, text: 'needle' })!;
    expect(hit.line.length).toBeLessThanOrEqual(182);
    const html = renderHitSnippet(hit);
    expect(html).toContain('<mark>needle</mark>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('keeps a zero-length regex finite and gives old saved views literal semantics', () => {
    const q = { ...EMPTY_FIND, text: '^|x', textRegex: true };
    expect(textPatternError(q)).toBeNull();
    expect(scanContent('x\ny', q)?.count).toBe(2);
    expect(textPatternError({ ...q, text: '(' })).toBe('Invalid text regex');
    const old = '#find=' + encodeURIComponent(JSON.stringify({ scope: 'here', text: 'a.b', exts: [] }));
    const restored = findFromHash(old)!;
    expect(restored.textRegex).toBe(false);
    expect(scanContent('a.b axb', restored)?.count).toBe(1);
  });
  it('stops scheduling work when a query is cancelled during four reads', async () => {
    const pending: Array<(text: string) => void> = [];
    let cancelled = false;
    const files = Array.from({ length: 12 }, (_, i) => f(`${i}.txt`));
    const task = searchContents(files, () => new Promise(resolve => pending.push(resolve)),
      { ...EMPTY_FIND, text: 'hit' }, undefined, () => cancelled);
    await Promise.resolve();
    expect(pending).toHaveLength(4);
    pending[0]('hit');
    await new Promise(resolve => setTimeout(resolve, 0));
    cancelled = true;
    pending.slice(1).forEach(resolve => resolve('hit'));
    const result = await task;
    expect(result.cancelled).toBe(true);
    expect(result.hits.size).toBe(1);
    expect(pending).toHaveLength(5);
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
