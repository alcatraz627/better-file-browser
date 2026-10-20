import { describe, it, expect } from 'vitest';
import { esc, fmtSize, fmtDate, fmtType, getExt, fullPath, splitMiddle, midHtml, pageHref } from '../src/utils';
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
  it('names the type in words', () => {
    expect(fmtType(file('readme.md'))).toBe('Markdown');
    expect(fmtType(file('photo.PNG'))).toBe('PNG image');
  });
  it('falls back to the extension, then File', () => {
    expect(fmtType(file('data.xyz'))).toBe('XYZ file');
    expect(fmtType(file('Makefile'))).toBe('Makefile');
    expect(fmtType(file('LICENSE'))).toBe('File');
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
  it('recognizes known extensionless source files', () => { expect(getExt(file('Makefile'))).toBe('makefile'); });
  it('returns empty string for an ordinary extensionless file', () => { expect(getExt(file('README'))).toBe(''); });
  it('returns empty string for dirs', () => { expect(getExt(dir('src'))).toBe(''); });
  it('reads a dotfile name as no extension, except known ones', () => {
    expect(getExt(file('.DS_Store'))).toBe('');
    expect(getExt(file('.leading-dot'))).toBe('');
    expect(getExt(file('.env'))).toBe('env');
    expect(getExt(file('.gitignore'))).toBe('gitignore');
    expect(getExt(file('.eslintrc.json'))).toBe('json');
  });
  it('does not read a long tail after a dot as an extension', () => {
    expect(getExt(file('report.thisisaverylongnotreallyanextension'))).toBe('');
  });
});

describe('splitMiddle', () => {
  it('keeps a short title whole', () => {
    expect(splitMiddle('Grocery list')).toEqual({ head: 'Grocery list', tail: '' });
  });
  it('keeps the last ten characters of a long title in the tail', () => {
    const t = 'A title that keeps going and going until the end';
    expect(splitMiddle(t)).toEqual({ head: t.slice(0, -10), tail: 'until the end'.slice(-10) });
  });
  it('never cuts an emoji in half', () => {
    const t = 'x'.repeat(30) + '🍅🍅🍅🍅🍅';
    const { head, tail } = splitMiddle(t, 3);
    expect(tail).toBe('🍅🍅🍅');
    expect(head + tail).toBe(t);
  });
  it('escapes both halves', () => {
    expect(midHtml('<b>' + 'y'.repeat(30) + '</b>')).not.toContain('<b>');
  });
});

describe('pageHref', () => {
  it('sends download types to their folder view and leaves the rest alone', () => {
    expect(pageHref('file:///a/b/conf.yaml')).toBe('file:///a/b/#view=conf.yaml');
    expect(pageHref('file:///a/My%20Dir/q.SQL')).toBe('file:///a/My%20Dir/#view=q.SQL');
    expect(pageHref('file:///a/b/readme.md')).toBe('file:///a/b/readme.md');
    expect(pageHref('file:///a/b/')).toBe('file:///a/b/');
    expect(pageHref('https://x.com/a.yaml')).toBe('https://x.com/a.yaml');
  });
});
