import { describe, it, expect } from 'vitest';
import { fileMeta, metaSummary, kindName } from '../src/file-meta';

const val = (m: ReturnType<typeof fileMeta>, k: string) => m.items.find(i => i.key === k)?.value;

describe('file metadata', () => {
  it('counts lines, words and headings in markdown, ignoring fenced code', () => {
    const m = fileMeta('# A\n\ntext here\n```\n# not a heading\n```\n## B\n', 'md', '/x.md');
    expect(m.kind).toBe('Markdown');
    expect(val(m, 'lines')).toBe('7 lines');
    expect(val(m, 'headings')).toBe('2 headings');
    expect(val(m, 'words')).toBe('12 words');
  });

  it('counts rows and columns of a table without the header row', () => {
    const m = fileMeta('a,b,c\n1,2,3\n4,5,6\n', 'csv', '/t.csv');
    expect(val(m, 'rows')).toBe('2 rows');
    expect(val(m, 'cols')).toBe('3 columns');
  });

  it('counts JSON keys or items, and skips the count for lax JSON', () => {
    expect(val(fileMeta('{"a":1,"b":2}', 'json', '/a.json'), 'keys')).toBe('2 top-level keys');
    expect(val(fileMeta('[1,2,3]', 'json', '/a.json'), 'items')).toBe('3 items');
    expect(val(fileMeta('{a:1,}', 'json', '/a.json'), 'keys')).toBeUndefined();
  });

  it('summarises as kind, size and lines; unknown kinds use the extension', () => {
    expect(metaSummary(fileMeta('one\ntwo\n', 'txt', '/a.txt'))).toBe('Text · 8 B · 2 lines');
    expect(kindName('xyz')).toBe('XYZ file');
    expect(val(fileMeta('', 'txt', '/e.txt'), 'lines')).toBe('0 lines');
  });
});
