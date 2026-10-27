import { describe, it, expect } from 'vitest';
import {
  EMPTY, openTab, closeTab, closeOthers, activate, togglePin, step, moveTab, labelFor, kindOf, isTabState, normalize,
  isStale, insertTab, displayLabels, splitLabel, closeToRight, distinctKeeps, restoreClosed, type RecoveryEntry,
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

  it('a background open adds the tab after the active one without activating it', () => {
    let s = openTab(openTab(EMPTY, '/a/'), '/b/');
    s = activate(s, s.list[0].id);
    s = openTab(s, '/c/', true);
    expect(s.list.map(t => t.label)).toEqual(['a', 'c', 'b']);
    expect(s.list.find(t => t.id === s.active)?.label).toBe('a');
    expect(openTab(s, '/b/', true)).toBe(s);
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

  it('reinserts a closed tab at its old index, never inside the pinned block or twice', () => {
    let s = openTab(openTab(openTab(EMPTY, '/a/'), '/b/'), '/c/');
    const b = s.list[1];
    s = closeTab(s, b.id);
    s = togglePin(s, s.list[0].id);
    s = insertTab(s, b, 0);
    expect(s.list.map(t => t.label)).toEqual(['a', 'b', 'c']);
    expect(insertTab(s, b, 0)).toBe(s);
  });

  it('shows the folder on labels that collide', () => {
    const s = openTab(openTab(openTab(EMPTY, '/x/docs/readme.md'), '/y/readme.md'), '/z/');
    expect(displayLabels(s.list)).toEqual(['docs/readme.md', 'y/readme.md', 'z']);
  });

  it('splits long labels for middle truncation, keeping the end whole', () => {
    // Short labels stay whole (no tail span).
    expect(splitLabel('readme.md')).toEqual({ head: 'readme.md', tail: '' });
    // A long file name keeps its extension; a long folder name keeps its start.
    const { head, tail } = splitLabel('components/very-long-name.tsx');
    expect(tail).toBe('.tsx');
    expect(splitLabel('photos-from-trip')).toEqual({ head: 'photos-from-trip', tail: '' });
    expect(head + tail).toBe('components/very-long-name.tsx');
    // The disambiguating folder prefix stays at the head's start.
    expect(head.startsWith('components/')).toBe(true);
  });

  it('a closed strip expires after a day or when empty', () => {
    const at = 1_000_000;
    const strip = (label: string): RecoveryEntry['state'] => openTab(EMPTY, `/${label}/`);
    const entries: Record<string, RecoveryEntry> = {
      live:  { state: strip('live'),  at: at - 10, closed: false },
      empty: { state: EMPTY, at: at - 1, closed: true },
      stale: { state: strip('stale'), at: at - 25 * 3600e3, closed: true },
    };
    expect(isStale(entries.stale, at)).toBe(true);
    expect(isStale(entries.empty, at)).toBe(true);
    expect(isStale(entries.live, at)).toBe(false);
  });
});

describe('crowded strips', () => {
  it('keeps the end that tells similar names apart', () => {
    const names = ['quarterly-report-final-001.csv', 'quarterly-report-final-002.csv', 'readme-for-the-team.md'];
    const keeps = distinctKeeps(names);
    const shown = names.map((n, i) => { const { tail } = splitLabel(n, keeps[i]); return tail; });
    expect(new Set(shown.slice(0, 2)).size).toBe(2);
    expect(keeps[2]).toBe(0);
  });

  it('tells apart names that differ far from their end, in a short tail', () => {
    const names = ['2026-01-meeting-notes-final.md', '2026-02-meeting-notes-final.md'];
    const keeps = distinctKeeps(names);
    const shown = names.map((n, i) => splitLabel(n, keeps[i]).tail);
    expect(new Set(shown).size).toBe(2);
    shown.forEach(t => { expect(t.length).toBeLessThanOrEqual(14); expect(t.endsWith('.md')).toBe(true); });
  });

  it('undo after Close others puts every tab back in order and the active tab back too', () => {
    const s = activate(openTab(openTab(openTab(openTab(EMPTY, '/a'), '/b'), '/c'), '/d'), '');
    const was = { ...s, active: s.list[1].id };
    const next = closeOthers(was, was.list[3].id);
    expect(next.active).toBe(was.list[3].id);
    const gone = was.list.map((t, index) => ({ t, index })).filter(x => !next.list.some(n => n.id === x.t.id));
    const back = restoreClosed(next, gone, was.active);
    expect(back.list.map(t => t.path)).toEqual(['/a', '/b', '/c', '/d']);
    expect(back.active).toBe(was.list[1].id);
  });

  it('closes everything right of a tab but never a pinned tab', () => {
    let s = openTab(openTab(openTab(openTab(EMPTY, '/a'), '/b'), '/c'), '/d');
    s = togglePin(s, s.list[3].id);
    const b = s.list.find(t => t.path === '/b')!;
    const out = closeToRight(s, b.id);
    expect(out.list.map(t => t.path).sort()).toEqual(['/a', '/b', '/d']);
  });
});
