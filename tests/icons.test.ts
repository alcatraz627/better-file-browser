import { describe, it, expect } from 'vitest';
import { getIcon, IMG_EXTS } from '../src/icons';
import type { Entry, IconRule } from '../src/types';

const file = (name: string): Entry =>
  ({ name, href: name, isDir: false, isParent: false, isHidden: false, rawBytes: 0, dateStr: '' });
const dir = (name: string): Entry =>
  ({ name, href: name + '/', isDir: true, isParent: false, isHidden: false, rawBytes: -1, dateStr: '' });
const parent = (): Entry =>
  ({ name: '..', href: '../', isDir: false, isParent: true, isHidden: false, rawBytes: -1, dateStr: '' });

const rules: IconRule[] = [
  { id: 'r1', pattern: '\\.md$', label: 'MD', color: '#4a9eff', enabled: true },
  { id: 'r2', pattern: '\\.log$', label: 'LOG', color: '#888', enabled: false },
];

describe('getIcon', () => {
  it('returns SVG for parent entry', () => {
    const html = getIcon(parent(), null);
    expect(html).toContain('<svg');
  });

  it('returns SVG folder icon for directories', () => {
    const html = getIcon(dir('src'), null);
    expect(html).toContain('<svg');
    // folder SVG uses blue fill
    expect(html).toContain('#4a9eff');
  });

  it('applies custom rule when matched and enabled', () => {
    const html = getIcon(file('readme.md'), rules);
    // custom rule label and color appear in the SVG
    expect(html).toContain('MD');
    expect(html).toContain('#4a9eff');
  });

  it('does not apply disabled rule (uses fallback, not custom color)', () => {
    const html = getIcon(file('debug.log'), rules);
    // disabled rule: custom color #888 should NOT appear
    expect(html).not.toContain('#888');
  });

  it('returns SVG file icon when no rule matches', () => {
    const html = getIcon(file('archive.zip'), rules);
    expect(html).toContain('<svg');
    // no MD custom color
    expect(html).not.toContain('#4a9eff');
  });
});

describe('IMG_EXTS', () => {
  it('contains common image extensions', () => {
    expect(IMG_EXTS.has('png')).toBe(true);
    expect(IMG_EXTS.has('jpg')).toBe(true);
    expect(IMG_EXTS.has('svg')).toBe(true);
  });
  it('does not contain non-image extensions', () => {
    expect(IMG_EXTS.has('ts')).toBe(false);
    expect(IMG_EXTS.has('md')).toBe(false);
  });
});
