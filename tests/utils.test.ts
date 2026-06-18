import { describe, it, expect } from 'vitest';
import { esc, fmtSize, fmtDate, fmtType, getExt, fullPath } from '../src/utils';
import type { Entry } from '../src/types';

const file = (name: string, rawBytes = 0, dateStr = ''): Entry =>
  ({ name, href: name, isDir: false, isParent: false, isHidden: false, rawBytes, dateMs: NaN, dateStr });
const dir = (name: string): Entry =>
  ({ name, href: name + '/', isDir: true, isParent: false, isHidden: false, rawBytes: -1, dateMs: NaN, dateStr: '' });

describe('esc', () => {
  it('escapes HTML special chars', () => {
    expect(esc('<script>alert("x")&</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&amp;&lt;/script&gt;');
  });
  it('handles plain strings untouched', () => {
    expect(esc('hello world')).toBe('hello world');
  });
  it('handles non-string via coercion', () => {
    expect(esc(42 as unknown as string)).toBe('42');
  });
});

describe('fmtSize', () => {
  it('formats bytes', () => { expect(fmtSize(512)).toBe('512 B'); });
  it('formats kilobytes', () => { expect(fmtSize(1536)).toBe('1.5 KB'); });
  it('formats megabytes', () => { expect(fmtSize(2 * 1024 * 1024)).toBe('2.0 MB'); });
  it('returns dash for unknown (-1)', () => { expect(fmtSize(-1)).toBe('—'); });
});

describe('fmtDate', () => {
  it('returns dash for unknown date (NaN, no fallback)', () => { expect(fmtDate(NaN)).toBe('—'); });

  it('formats an epoch (short)', () => {
    const result = fmtDate(Date.UTC(2024, 5, 15, 12, 0), { dateFormat: 'short' });
    expect(result).toMatch(/Jun/);
  });
  it('formats an epoch (full)', () => {
    const result = fmtDate(Date.UTC(2024, 5, 15, 12, 0), { dateFormat: 'full' });
    expect(result).toMatch(/June.*2024/);
  });

  // Regression: the bug was new Date("12/06/2026,…") parsing DD/MM as MM/DD →
  // "Dec 6". With the epoch source it must read as June (mid-day UTC → TZ-robust).
  it('reads a June epoch as June, not December (the DD/MM bug)', () => {
    const jun12_2026 = 1781270523000; // 2026-06-12 ~18:42 UTC, the fixture mtime class
    const result = fmtDate(jun12_2026, { dateFormat: 'short' });
    expect(result).toMatch(/Jun/);
    expect(result).not.toMatch(/Dec/);
  });

  it('falls back to a parseable raw string when epoch is unknown', () => {
    expect(fmtDate(NaN, { dateFormat: 'short' }, '2024-06-15T12:00:00Z')).toMatch(/Jun/);
  });
  it('returns the raw string verbatim when it is unparseable', () => {
    expect(fmtDate(NaN, undefined, 'whenever')).toBe('whenever');
  });
});

describe('fmtType', () => {
  it('returns Folder for dirs', () => { expect(fmtType(dir('docs'))).toBe('Folder'); });
  it('returns extension type for files', () => {
    expect(fmtType(file('readme.md'))).toBe('MD File');
  });
  it('returns File for extensionless files', () => {
    expect(fmtType(file('Makefile'))).toBe('File');
  });
});

describe('fullPath', () => {
  it('joins rawPath + file name', () => {
    expect(fullPath('/a/b/', file('x.ts'))).toBe('/a/b/x.ts');
    expect(fullPath('/a/b', file('x.ts'))).toBe('/a/b/x.ts');   // tolerates missing trailing slash
  });
  it('appends a trailing slash for directories', () => {
    expect(fullPath('/a/b/', dir('sub'))).toBe('/a/b/sub/');
  });
});

describe('getExt', () => {
  it('extracts lowercase extension', () => { expect(getExt(file('Image.PNG'))).toBe('png'); });
  it('returns empty string for no extension', () => { expect(getExt(file('Makefile'))).toBe(''); });
  it('returns empty string for dirs', () => { expect(getExt(dir('src'))).toBe(''); });
});
