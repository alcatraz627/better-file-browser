import { describe, it, expect } from 'vitest';
import { KEYMAP, capsFor } from '../src/keymap';
import { keyToken, score } from '../src/commands';

const ev = (key: string, mods: Partial<Record<'metaKey' | 'shiftKey' | 'altKey' | 'ctrlKey', boolean>> = {}, code = '') =>
  ({ key, code, metaKey: false, shiftKey: false, altKey: false, ctrlKey: false, ...mods }) as KeyboardEvent;

describe('keymap', () => {
  it('has unique ids', () => {
    const ids = KEYMAP.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('never gives one key two commands in the same place', () => {
    const seen = new Map<string, string>();
    for (const d of KEYMAP.filter(x => x.own)) for (const k of d.keys) {
      const slot = `${d.scope ?? 'any'}|${k}`;
      expect(seen.get(slot), `${k} in ${d.scope ?? 'any'}: ${seen.get(slot)} and ${d.id}`).toBeUndefined();
      seen.set(slot, d.id);
    }
  });
  it('no own single key starts a sequence too', () => {
    // A decision page has no "g …" sequences, and dispatch runs a scoped
    // single key before it waits for a second, so its "g" (first card) is fine.
    const singles = new Set(KEYMAP.filter(d => d.own && d.scope !== 'decision').flatMap(d => d.keys).filter(k => !k.includes(' ')));
    const starts = new Set(KEYMAP.filter(d => d.own).flatMap(d => d.keys).filter(k => k.includes(' ') && !k.startsWith('hold ')).map(k => k.split(' ')[0]));
    for (const s of starts) expect(singles.has(s), s).toBe(false);
  });
});

describe('capsFor', () => {
  it('splits modifiers and keys', () => {
    expect(capsFor('⌘K')).toEqual(['meta', 'k']);
    expect(capsFor('⇧T')).toEqual(['shift', 't']);
    expect(capsFor('?')).toEqual(['shift', '/']);
    expect(capsFor('g h')).toEqual(['g', 'h']);
    expect(capsFor('⇧F6')).toEqual(['shift', 'f6']);
    expect(capsFor('⌥↩')).toEqual(['alt', 'enter']);
    expect(capsFor('hold ⌥')).toEqual(['alt']);
    expect(capsFor('Home')).toEqual(['fn', 'left']);
  });
});

describe('keyToken', () => {
  it('writes keys the way the key map does', () => {
    expect(keyToken(ev('k', { metaKey: true }))).toBe('⌘K');
    expect(keyToken(ev('T', { shiftKey: true }))).toBe('⇧T');
    expect(keyToken(ev('?', { shiftKey: true }))).toBe('?');
    expect(keyToken(ev('{', { shiftKey: true }))).toBe('⇧[');
    expect(keyToken(ev('ArrowDown', { shiftKey: true }))).toBe('⇧↓');
    expect(keyToken(ev('Enter', { altKey: true }))).toBe('⌥↩');
    expect(keyToken(ev('F6', { shiftKey: true }))).toBe('⇧F6');
    expect(keyToken(ev('˙', { altKey: true }, 'KeyH'))).toBe('⌥H');
    expect(keyToken(ev('.'))).toBe('.');
  });
  it('every own key is something keyToken can produce', () => {
    const producible = (k: string) => k.startsWith('hold ') || k.split(' ').every(p => /^([⌘⌃⌥⇧]*)(.+)$/.test(p));
    for (const d of KEYMAP.filter(x => x.own)) for (const k of d.keys) expect(producible(k), k).toBe(true);
  });
});

describe('palette score', () => {
  it('prefers a word start, then a substring, then a loose match', () => {
    expect(score('List', 'list')).toBeGreaterThan(score('Hidden files list', 'list'));
    expect(score('Sort by name', 'sbn')).toBeGreaterThan(0);
    expect(score('Tree', 'xyz')).toBe(0);
    expect(score('Copy selected paths', 'sett')).toBe(0);
    expect(score('Settings', 'sett')).toBeGreaterThan(score('Copy selected paths', 'sele'));
  });
});
