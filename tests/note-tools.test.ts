import { describe, it, expect } from 'vitest';
import { formatEdit, formatKey, picturePlace, tableAt } from '../src/note-tools';

describe('format buttons', () => {
  const on = (name: string, text: string, start = 0, end = start) => formatEdit(name, text, { start, end })!;
  it('wraps the selection and keeps it selected', () => {
    const r = on('bold', 'one two', 0, 3);
    expect(r.text).toBe('**one** two');
    expect(r.text.slice(r.start, r.end)).toBe('one');
  });
  it('prefixes every selected line', () => {
    expect(on('quote', 'a\nb', 0, 3).text).toBe('> a\n> b');
    expect(on('task', 'a\nb\nc', 0, 3).text).toBe('- [ ] a\n- [ ] b\nc');
    expect(on('olist', 'a\nb', 0, 3).text).toBe('1. a\n2. b');
  });
  it('goes deeper with each heading press, then back to plain', () => {
    expect(on('heading', 'x').text).toBe('# x');
    expect(on('heading', '# x').text).toBe('## x');
    expect(on('heading', '### x').text).toBe('x');
  });
  it('selects the address of a new link', () => {
    const r = on('link', 'see this', 4, 8);
    expect(r.text).toBe('see [this](url)');
    expect(r.text.slice(r.start, r.end)).toBe('url');
  });
  it('is nothing for a name that is not a format', () => {
    expect(formatEdit('versions', 'x', { start: 0, end: 0 })).toBeNull();
  });
});

describe('a new table', () => {
  it('starts on its own line', () => {
    expect(tableAt('abc', 3).startsWith('\n|')).toBe(true);
    expect(tableAt('abc\n', 4).startsWith('|')).toBe(true);
    expect(tableAt('', 0).startsWith('|')).toBe(true);
  });
});

describe('format keys', () => {
  const key = (key: string, o: Partial<KeyboardEventInit> = {}) => formatKey({ metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, key, ...o } as KeyboardEvent);
  it('names the format a key stands for', () => {
    expect(key('b')).toBe('bold');
    expect(key('X', { shiftKey: true })).toBe('strike');
    expect(key('>', { shiftKey: true })).toBe('quote');
  });
  it('leaves other keys and plain typing alone', () => {
    expect(key('k')).toBeNull();
    expect(key('b', { metaKey: false })).toBeNull();
    expect(key('b', { altKey: true })).toBeNull();
  });
});

describe('where a picture goes', () => {
  const now = 36 ** 3;
  it('uses the one attachments folder in Notes, linked from wherever the note sits', () => {
    const p = picturePlace('/n', 'deep/er/plan.md', '/n', 'png', now);
    expect(p.root).toBe('/n');
    expect(p.rel).toBe('attachments/plan-1000.png');
    expect(p.ref).toBe('../../attachments/plan-1000.png');
  });
  it('finds the Notes folder when the file was opened through a folder above it', () => {
    const p = picturePlace('/home', 'n/a/plan.md', '/home/n', 'png', now);
    expect(p.root).toBe('/home/n');
    expect(p.ref).toBe('../attachments/plan-1000.png');
  });
  it('goes beside the file anywhere else', () => {
    const p = picturePlace('/code', 'docs/guide.md', '/n', 'jpg', now);
    expect(p.root).toBe('/code');
    expect(p.rel).toBe('docs/attachments/guide-1000.jpg');
    expect(p.ref).toBe('attachments/guide-1000.jpg');
  });
  it('is not fooled by a folder whose name only starts like Notes', () => {
    expect(picturePlace('/n2', 'a.md', '/n', 'png', now).root).toBe('/n2');
  });
});
