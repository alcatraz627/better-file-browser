import { describe, it, expect } from 'vitest';
import { EMPTY, openTab, closeTab, activate, step, moveTab, labelFor, isTabState } from '../src/tabs';

describe('tabs', () => {
  it('opens a tab after the active one and activates it; reopening focuses instead of duplicating', () => {
    let s = openTab(EMPTY, '/a/');
    s = openTab(s, '/b/');
    const first = s.list[0].id;
    s = activate(s, first);
    s = openTab(s, '/c/');
    expect(s.list.map(t => t.path)).toEqual(['/a/', '/c/', '/b/']);
    expect(s.list.find(t => t.id === s.active)?.path).toBe('/c/');
    const again = openTab(s, '/a/');
    expect(again.list.length).toBe(3);
    expect(again.list.find(t => t.id === again.active)?.path).toBe('/a/');
  });

  it('closing the active tab activates the neighbour, closing the last leaves none', () => {
    let s = openTab(openTab(openTab(EMPTY, '/a/'), '/b/'), '/c/');
    const c = s.active!;
    s = closeTab(s, c);
    expect(s.list.find(t => t.id === s.active)?.path).toBe('/b/');
    s = closeTab(s, s.list[0].id);
    s = closeTab(s, s.list[0].id);
    expect(s).toEqual({ list: [], active: null });
    expect(closeTab(s, 'nope')).toBe(s);
  });

  it('steps with wrap-around', () => {
    const s = openTab(openTab(EMPTY, '/a/'), '/b/');
    expect(step(s, 1)?.path).toBe('/a/');
    expect(step(s, -1)?.path).toBe('/a/');
    expect(step(EMPTY, 1)).toBeNull();
  });

  it('moves a tab and labels a path by its last segment', () => {
    const s = openTab(openTab(EMPTY, '/a/'), '/b/x y/');
    const moved = moveTab(s, s.list[1].id, s.list[0].id);
    expect(moved.list.map(t => t.label)).toEqual(['x y', 'a']);
    expect(labelFor('/')).toBe('/');
  });

  it('validates a stored record', () => {
    expect(isTabState({ list: [], active: null })).toBe(true);
    expect(isTabState({ list: [{ id: 1 }], active: null })).toBe(false);
    expect(isTabState(null)).toBe(false);
  });
});
