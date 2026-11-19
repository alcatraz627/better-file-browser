import { describe, expect, it } from 'vitest';
import { findThemeHooks, oppositeClasses } from '../src/site-lights-sheets';

const times = (sel: string, n = 3) => Array.from({ length: n }, (_, i) => `${sel} .x${i}`);

describe('findThemeHooks', () => {
  it('finds a Tailwind dark class and a long Wikipedia-style night class', () => {
    expect(findThemeHooks(times('.dark'))).toEqual([{ on: 'html', kind: 'class', name: 'dark' }]);
    expect(findThemeHooks(times('html.skin-theme-clientpref-night'))).toEqual([{ on: 'html', kind: 'class', name: 'skin-theme-clientpref-night' }]);
  });

  it('finds Tailwind v4 classes written inside :where()', () => {
    const v4 = ['.dark\\:bg-a:where(.dark, .dark *)', '.dark\\:bg-b:where(.dark, .dark *)', '.dark\\:bg-c:where(.dark, .dark *)'];
    expect(findThemeHooks(v4).map(h => h.name)).toEqual(['dark']);
  });

  it('ignores classes that style an element rather than switch a theme', () => {
    expect(findThemeHooks(['.btn-dark', '.btn-dark:hover', '.btn-dark:focus', '.dark\\:bg-x', '.dark\\:bg-y', '.dark\\:bg-z'])).toEqual([]);
  });

  it('finds an attribute switch and keeps one class switch only', () => {
    const hooks = findThemeHooks([...times('[data-theme="dark"]'), ...times('.dark', 5), ...times('.theme-dark', 3)]);
    expect(hooks).toEqual([
      { on: 'html', kind: 'class', name: 'dark' },
      { on: 'html', kind: 'attr', name: 'data-theme', value: 'dark' },
    ]);
  });

  it('needs a switch to appear a few times before trusting it', () => {
    expect(findThemeHooks(times('.dark', 2))).toEqual([]);
  });
});

describe('oppositeClasses', () => {
  it('pairs a dark or night class with its light or day twin', () => {
    expect(oppositeClasses('skin-theme-clientpref-night')).toContain('skin-theme-clientpref-day');
    expect(oppositeClasses('theme-dark')).toContain('theme-light');
    expect(oppositeClasses('dark')).not.toContain('dark');
  });
});
