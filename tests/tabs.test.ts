import { describe, it, expect } from 'vitest';
import {
  EMPTY, openTab, closeTab, closeOthers, activate, togglePin, step, moveTab, labelFor, kindOf, isTabState, normalize,
  pickRecovery, isStale, type RecoveryEntry,
} from '../src/tabs';

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

  it('validates a stored record and fills in kind and pin for an older one', () => {
    expect(isTabState({ list: [], active: null })).toBe(true);
    expect(isTabState({ list: [{ id: 1 }], active: null })).toBe(false);
    expect(isTabState(null)).toBe(false);
    const old = normalize({ list: [{ id: 'a', path: '/a/' } as never, { id: 'b', path: '/b/x.md' } as never], active: 'a' });
    expect(old.list.map(t => [t.kind, t.pinned, t.label])).toEqual([['folder', false, 'a'], ['file', false, 'x.md']]);
  });

  it('a file path opens as a file tab', () => {
    expect(kindOf('/a/')).toBe('folder');
    expect(kindOf('/a/notes.md')).toBe('file');
    const s = openTab(EMPTY, '/a/notes.md');
    expect(s.list[0]).toMatchObject({ kind: 'file', label: 'notes.md', pinned: false });
  });

  it('pinned tabs sit first; new tabs never land inside the pinned block', () => {
    let s = openTab(openTab(openTab(EMPTY, '/a/'), '/b/'), '/c/');
    const c = s.list[2].id;
    s = togglePin(s, c);
    expect(s.list.map(t => t.label)).toEqual(['c', 'a', 'b']);
    expect(s.list[0].pinned).toBe(true);
    s = activate(s, c);
    s = openTab(s, '/d/');
    expect(s.list.map(t => t.label)).toEqual(['c', 'd', 'a', 'b']);
    s = togglePin(s, c);
    expect(s.list.map(t => t.pinned)).toEqual([false, false, false, false]);
    expect(s.list[0].label).toBe('c');
  });

  it('drag never crosses the pinned boundary', () => {
    let s = openTab(openTab(EMPTY, '/a/'), '/b/');
    s = togglePin(s, s.list[0].id);
    expect(moveTab(s, s.list[1].id, s.list[0].id)).toBe(s);
  });

  it('close others keeps pinned tabs and the one named', () => {
    let s = openTab(openTab(openTab(EMPTY, '/a/'), '/b/'), '/c/');
    s = togglePin(s, s.list[0].id);
    const b = s.list.find(t => t.label === 'b')!.id;
    s = closeOthers(s, b);
    expect(s.list.map(t => t.label)).toEqual(['a', 'b']);
    expect(s.active).toBe(b);
    expect(closeOthers(s, 'nope')).toBe(s);
  });

  it('recovery picks the newest closed strip inside the window and prunes the rest', () => {
    const at = 1_000_000;
    const strip = (label: string): RecoveryEntry['state'] => openTab(EMPTY, `/${label}/`);
    const entries: Record<string, RecoveryEntry> = {
      live:  { state: strip('live'),  at: at - 10, closed: false },
      older: { state: strip('older'), at: at - 5000, closed: true },
      newer: { state: strip('newer'), at: at - 100, closed: true },
      empty: { state: EMPTY, at: at - 1, closed: true },
      stale: { state: strip('stale'), at: at - 25 * 3600e3, closed: true },
    };
    expect(pickRecovery(entries, at)).toBe('newer');
    expect(pickRecovery({ live: entries.live }, at)).toBeNull();
    expect(isStale(entries.stale, at)).toBe(true);
    expect(isStale(entries.empty, at)).toBe(true);
    expect(isStale(entries.live, at)).toBe(false);
  });
});
