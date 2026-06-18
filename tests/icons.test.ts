import { describe, it, expect } from 'vitest';
import { getIcon, IMG_EXTS, safeColor } from '../src/icons';
import type { Entry, IconRule } from '../src/types';

const file = (name: string): Entry =>
  ({ name, href: name, isDir: false, isParent: false, isHidden: false, rawBytes: 0, dateMs: NaN, dateStr: '' });
const dir = (name: string): Entry =>
  ({ name, href: name + '/', isDir: true, isParent: false, isHidden: false, rawBytes: -1, dateMs: NaN, dateStr: '' });
const parent = (): Entry =>
  ({ name: '..', href: '../', isDir: false, isParent: true, isHidden: false, rawBytes: -1, dateMs: NaN, dateStr: '' });

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

  it('skips a rule with an invalid regex without throwing', () => {
    const bad: IconRule[] = [{ id: 'x', pattern: '[invalid(', label: 'X', color: '#fff', enabled: true }];
    expect(() => getIcon(file('a.md'), bad)).not.toThrow();
    expect(getIcon(file('a.md'), bad)).toContain('<svg');
  });

  it('first matching enabled rule wins (precedence)', () => {
    const r: IconRule[] = [
      { id: '1', pattern: '\\.md$', label: 'FST', color: '#111111', enabled: true },
      { id: '2', pattern: 'a',      label: 'SND', color: '#222222', enabled: true },
    ];
    expect(getIcon(file('a.md'), r)).toContain('FST');
  });

  it('sanitizes a malicious rule color (XSS guard) — no quote breakout in output', () => {
    const evil: IconRule[] = [{ id: 'e', pattern: '\\.md$', label: 'E', color: '#000" onload="alert(1)', enabled: true }];
    const html = getIcon(file('a.md'), evil);
    expect(html).not.toContain('onload');
    expect(html).toContain('#6e7681');   // fell back to the safe default
  });
});

describe('safeColor', () => {
  it('accepts hex and bare CSS keywords', () => {
    expect(safeColor('#fff')).toBe('#fff');
    expect(safeColor('#1f6feb')).toBe('#1f6feb');
    expect(safeColor('red')).toBe('red');
  });
  it('rejects anything with quotes/markup → default', () => {
    expect(safeColor('#000" onerror="x')).toBe('#6e7681');
    expect(safeColor('url(javascript:1)')).toBe('#6e7681');
    expect(safeColor('')).toBe('#6e7681');
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
