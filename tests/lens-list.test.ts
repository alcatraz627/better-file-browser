import { describe, it, expect } from 'vitest';
import { LENSES, lensOrder, lensOn, setLensOn } from '../src/lens-list';

const ids = (s: object) => lensOrder(s).map(l => l.id);

describe('sidebar sections', () => {
  it('keeps the built-in order until the person changes it', () => {
    expect(ids({})).toEqual(LENSES.map(l => l.id));
  });
  it('follows a saved order, and drops names it does not know or repeats', () => {
    const saved = ['ask', 'notes', 'gone', 'notes', ...LENSES.map(l => l.id).filter(id => id !== 'ask' && id !== 'notes')];
    expect(ids({ lensOrder: saved }).slice(0, 2)).toEqual(['ask', 'notes']);
    expect(ids({ lensOrder: saved })).toHaveLength(LENSES.length);
  });
  it('puts a lens missing from a saved order after the one it follows', () => {
    // A saved order from before Decisions and Comments existed.
    const old = ['notes', 'home', 'places', 'saved', 'history', 'search', 'ask'];
    expect(ids({ lensOrder: old })).toEqual(['notes', 'home', 'places', 'saved', 'history', 'search', 'ask', 'comments', 'decisions']);
    expect(ids({ lensOrder: ['decisions'] })[0]).toBe('home');
    expect(ids({ lensOrder: ['decisions'] }).at(-1)).toBe('decisions');
  });
  it('reads History from the older hideRecent switch', () => {
    expect(lensOn({ hideRecent: true }, 'history')).toBe(false);
    const s: { hideRecent?: boolean; lensOff?: string[] } = { hideRecent: true };
    expect(setLensOn(s, 'history', true)).toBe(true);
    expect(s.hideRecent).toBe(false);
    expect(s.lensOff).toBeUndefined();
  });
  it('switches others off and on without repeats', () => {
    const s: { lensOff?: string[] } = {};
    setLensOn(s, 'ask', false); setLensOn(s, 'ask', false);
    expect(s.lensOff).toEqual(['ask']);
    expect(lensOn(s, 'ask')).toBe(false);
    setLensOn(s, 'ask', true);
    expect(s.lensOff).toEqual([]);
  });
  it('keeps the last lens on', () => {
    const s: { lensOff?: string[]; hideRecent?: boolean } = { lensOff: LENSES.map(l => l.id).filter(id => id !== 'notes' && id !== 'history'), hideRecent: true };
    expect(setLensOn(s, 'notes', false)).toBe(false);
    expect(lensOn(s, 'notes')).toBe(true);
  });
});
