import { describe, it, expect } from 'vitest';
import { applyChange, changedKeys, duplicateText, readProps, clipboardNote } from '../src/notes';
import { tagRows, swapTag, nextColour } from '../src/tag-colours';
import { TAG_COLORS } from '../src/places';

const note = '---\ntitle: "Plan"\ncreated: 2026-10-01T10:00:00Z\ntags: "a", "b"\ncolor: blue\npinned: true\npos: i\nexpires: 2030-01-01T00:00:00Z\nremind_at: 2030-01-02T09:00:00Z\nremind_repeat: weekly\nreminder_id: abc\nupdated: 2026-10-02T00:00:00Z\n---\nBody line\n';

describe('expires', () => {
  it('is set, replaced and removed on its own line', () => {
    const set = applyChange('---\ntitle: "T"\ncreated: 2026-10-01T10:00:00Z\n---\nx\n', { expires: '2031-03-04T05:00:00Z' });
    expect(set).toContain('\nexpires: 2031-03-04T05:00:00Z\n');
    expect(readProps('t.md', set).expires).toBe('2031-03-04T05:00:00Z');
    expect(applyChange(set, { expires: '2032-01-01T00:00:00Z' }).match(/expires:/g)).toHaveLength(1);
    expect(applyChange(set, { expires: null })).not.toContain('expires');
  });
  it('is one of the keys a change may write', () => {
    expect(changedKeys({ expires: null })).toEqual(['expires']);
    expect(changedKeys({ color: null, expires: 'x' })).toEqual(['color', 'expires']);
  });
});

describe('duplicate', () => {
  const p = readProps('copy.md', duplicateText(note, new Date('2026-11-02T08:00:00Z')));
  it('keeps the words, tags, colour and link', () => {
    expect(p.title).toBe('Plan'); expect(p.tags).toEqual(['a', 'b']); expect(p.color).toBe('blue');
    expect(duplicateText(note)).toContain('Body line');
  });
  it('is not pinned, has no place, reminder or expiry, and is new', () => {
    expect(p.pinned).toBe(false); expect(p.pos).toBeUndefined();
    expect(p.remindAt).toBeUndefined(); expect(p.expires).toBeUndefined();
    expect(duplicateText(note)).not.toMatch(/reminder_id|remind_|expires|updated|pos:/);
  });
  it('leaves a note with no header alone', () => {
    expect(duplicateText('just text\n')).toBe('just text\n');
  });
});

describe('note from the clipboard', () => {
  it('is named from its first line and stamped as new', () => {
    const n = clipboardNote('\r\n  Buy oat milk\r\nand bread\r\n', new Date('2026-11-02T08:00:00Z'))!;
    expect(n.base).toBe('buy-oat-milk');
    expect(n.text).toBe('---\ncreated: 2026-11-02T08:00:00Z\n---\nBuy oat milk\nand bread\n');
  });
  it('is nothing when there is no text', () => {
    expect(clipboardNote('  \n ')).toBeNull();
  });
});

describe('tag colours page', () => {
  it('lists note and save tags with counts, most used first, plus colour-only tags', () => {
    const rows = tagRows([['a', 'b'], ['a']], [{ path: '/x', label: 'x', tags: ['a', 'c'] } as never], [{ name: 'b', color: '#58a6ff' }, { name: 'ghost', color: '#3fb950' }]);
    expect(rows.map(r => [r.tag, r.count])).toEqual([['a', 3], ['b', 1], ['c', 1], ['ghost', 0]]);
    expect(rows.find(r => r.tag === 'b')!.color).toBe('#58a6ff');
    expect(rows.find(r => r.tag === 'a')!.color).toBeNull();
  });
  it('swaps a tag without making a repeat', () => {
    expect(swapTag(['a', 'b'], 'a', 'c')).toEqual(['c', 'b']);
    expect(swapTag(['a', 'b'], 'a', 'b')).toEqual(['b']);
  });
  it('walks the palette and ends at no colour', () => {
    expect(nextColour(null)).toBe(TAG_COLORS[0]);
    expect(nextColour(TAG_COLORS[0])).toBe(TAG_COLORS[1]);
    expect(nextColour(TAG_COLORS[TAG_COLORS.length - 1])).toBeNull();
  });
});
