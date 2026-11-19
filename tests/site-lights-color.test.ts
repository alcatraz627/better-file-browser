import { describe, expect, it } from 'vitest';
import { isDark, mapValue, parseColor, roleForProperty, roleForVariable } from '../src/site-lights-color';

const lightnessOf = (css: string) => parseColor(css)!.l;

describe('parseColor', () => {
  it('reads every form a stylesheet commonly holds', () => {
    for (const css of ['#fff', '#ffffff', '#ffff', 'white', 'rgb(255, 255, 255)', 'rgb(255 255 255 / 50%)', 'hsl(0 0% 100%)', 'hsla(0, 0%, 100%, .5)', 'oklch(1 0 0)']) {
      expect(lightnessOf(css), css).toBeCloseTo(1, 2);
    }
    expect(lightnessOf('#000')).toBeCloseTo(0, 3);
  });

  it('leaves what it cannot read alone', () => {
    for (const css of ['currentcolor', 'transparent', 'inherit', 'var(--x)', 'rgb(var(--r) 0 0)', 'color-mix(in srgb, red, blue)']) {
      expect(parseColor(css), css).toBeNull();
    }
  });
});

describe('mapValue', () => {
  it('turns a white background dark and black text light', () => {
    expect(lightnessOf(mapValue('#fff', 'bg')!)).toBeLessThan(0.25);
    expect(lightnessOf(mapValue('black', 'text')!)).toBeGreaterThan(0.85);
  });

  it('keeps a dark header dark and white text on it light', () => {
    expect(lightnessOf(mapValue('#111', 'bg')!)).toBeLessThan(0.2);
    expect(lightnessOf(mapValue('#fff', 'text')!)).toBeGreaterThan(0.85);
  });

  it('keeps hue, so a pale blue panel becomes a dark blue one', () => {
    const before = parseColor('#dbeafe')!;
    const after = parseColor(mapValue('#dbeafe', 'bg')!)!;
    expect(after.l).toBeLessThan(0.35);
    expect(Math.abs(after.h - before.h)).toBeLessThan(8);
  });

  it('moves only the colours inside gradients, shadows and fallbacks', () => {
    const grad = mapValue('linear-gradient(90deg, #fff 0%, rgba(0,0,0,.5) 100%)', 'bg')!;
    expect(grad).toMatch(/^linear-gradient\(90deg, rgb\(\d+, \d+, \d+\) 0%, rgba\(0, 0, 0, 0\.5\) 100%\)$/);
    expect(mapValue('var(--x, #fff)', 'bg')).toMatch(/^var\(--x, rgb\(/);
    expect(mapValue('0 1px 2px #ccc', 'bg')).toMatch(/^0 1px 2px rgb\(/);
  });

  it('keeps oklch colours in oklch and keeps alpha', () => {
    expect(mapValue('oklch(0.98 0.01 250 / 0.5)', 'bg')).toMatch(/^oklch\([\d.]+ [\d.]+ 250 \/ 0\.5\)$/);
  });

  it('never touches urls or names that only contain a colour word', () => {
    expect(mapValue('url(white.png)', 'bg')).toBeNull();
    expect(mapValue('var(--white)', 'bg')).toBeNull();
    expect(mapValue('currentcolor', 'text')).toBeNull();
    expect(mapValue('none', 'bg')).toBeNull();
  });
});

describe('roles', () => {
  it('maps longhands to roles and skips properties without colours', () => {
    expect(roleForProperty('background-color')).toBe('bg');
    expect(roleForProperty('color')).toBe('text');
    expect(roleForProperty('border-top-color')).toBe('border');
    expect(roleForProperty('border-inline-start-color')).toBe('border');
    expect(roleForProperty('width')).toBeNull();
  });

  it('guesses a variable role from its name', () => {
    expect(roleForVariable('--color-bg-subtle')).toBe('bg');
    expect(roleForVariable('--fg-muted')).toBe('text');
    expect(roleForVariable('--border-default')).toBe('border');
    expect(roleForVariable('--brand-500')).toBe('any');
  });

  it('tells a dark page from a light one', () => {
    expect(isDark(parseColor('#181a1b')!)).toBe(true);
    expect(isDark(parseColor('#f6f8fa')!)).toBe(false);
  });
});
