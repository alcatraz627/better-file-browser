import { describe, it, expect } from 'vitest';
import { editableRoot, splitHighlighted } from '../src/file-editor';

describe('editableRoot', () => {
  const home = '/Users/me';
  it('finds the allowed folder holding a file, with ~ and trailing slashes', () => {
    expect(editableRoot('/Users/me/Code/app/a.md', ['~/Code/'], home)).toBe('/Users/me/Code');
    expect(editableRoot('/srv/x/y.yaml', [' /srv/x '], home)).toBe('/srv/x');
  });
  it('refuses a file outside every allowed folder, or a sibling sharing a prefix', () => {
    expect(editableRoot('/Users/me/Codex/a.md', ['~/Code'], home)).toBeNull();
    expect(editableRoot('/Users/me/a.md', [], home)).toBeNull();
    expect(editableRoot('/Users/me/a.md', undefined, home)).toBeNull();
  });
});

describe('allowing one file', () => {
  it('a listed file allows only itself, with its folder as the root', () => {
    expect(editableRoot('/Users/me/notes/a.md', ['/Users/me/notes/a.md'])).toBe('/Users/me/notes');
    expect(editableRoot('/Users/me/notes/b.md', ['/Users/me/notes/a.md'])).toBeNull();
  });
});

describe('splitHighlighted', () => {
  it('closes and reopens a token span that crosses a line end', () => {
    const rows = splitHighlighted('a<span class="tok-com">/* one\ntwo */</span>b\nc');
    expect(rows).toEqual(['a<span class="tok-com">/* one</span>', '<span class="tok-com">two */</span>b', 'c']);
  });
  it('keeps empty lines as rows', () => {
    expect(splitHighlighted('x\n\ny')).toEqual(['x', '', 'y']);
  });
});
