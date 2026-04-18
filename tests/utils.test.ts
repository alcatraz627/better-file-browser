import { describe, it, expect } from 'vitest';
import { esc, fmtSize, fmtDate, fmtType, getExt } from '../src/utils';
import type { Entry } from '../src/types';

const file = (name: string, rawBytes = 0, dateStr = ''): Entry =>
  ({ name, href: name, isDir: false, isParent: false, isHidden: false, rawBytes, dateStr });
const dir = (name: string): Entry =>
  ({ name, href: name + '/', isDir: true, isParent: false, isHidden: false, rawBytes: -1, dateStr: '' });

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
  it('returns dash for empty string', () => { expect(fmtDate('')).toBe('—'); });
  it('formats a valid date string (short)', () => {
    const result = fmtDate('2024-06-15 12:00', { dateFormat: 'short' });
    expect(result).toMatch(/Jun|6\/15|15\/6/);
  });
  it('formats a valid date string (full)', () => {
    const result = fmtDate('2024-06-15 12:00', { dateFormat: 'full' });
    expect(result).toMatch(/2024/);
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

describe('getExt', () => {
  it('extracts lowercase extension', () => { expect(getExt(file('Image.PNG'))).toBe('png'); });
  it('returns empty string for no extension', () => { expect(getExt(file('Makefile'))).toBe(''); });
  it('returns empty string for dirs', () => { expect(getExt(dir('src'))).toBe(''); });
});
