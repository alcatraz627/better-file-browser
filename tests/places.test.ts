import { describe, it, expect } from 'vitest';
import {
  upsertPlace, removePlace, renamePlace, movePlace, togglePlace,
  parseTags, setTags, reconcileTags, cycleTagColor, groupByTag, filterSaved, mergeLegacy, TAG_COLORS,
} from '../src/places';
import type { Place } from '../src/types';

const P = (path: string, label = path, tags?: string[]): Place => (tags ? { path, label, tags } : { path, label });

describe('upsertPlace', () => {
  it('appends a new place', () => {
    expect(upsertPlace([P('/a')], P('/b')).map(p => p.path)).toEqual(['/a', '/b']);
  });
  it('dedupes by path (no-op if present)', () => {
    const list = [P('/a', 'A')];
    expect(upsertPlace(list, P('/a', 'different'))).toBe(list);   // unchanged ref
  });
});

describe('removePlace', () => {
  it('removes by path', () => {
    expect(removePlace([P('/a'), P('/b')], '/a').map(p => p.path)).toEqual(['/b']);
  });
});

describe('renamePlace', () => {
  it('renames only the matching path', () => {
    const out = renamePlace([P('/a', 'A'), P('/b', 'B')], '/a', 'Alpha');
    expect(out).toEqual([{ path: '/a', label: 'Alpha' }, { path: '/b', label: 'B' }]);
  });
});

describe('movePlace', () => {
  it('reorders from one path to another position', () => {
    const list = [P('/a'), P('/b'), P('/c')];
    expect(movePlace(list, '/a', '/c').map(p => p.path)).toEqual(['/b', '/c', '/a']);
  });
  it('is a no-op for unknown paths or same position', () => {
    const list = [P('/a'), P('/b')];
    expect(movePlace(list, '/a', '/a')).toBe(list);
    expect(movePlace(list, '/x', '/b')).toBe(list);
  });
});

describe('togglePlace', () => {
  it('adds when absent and removes when present', () => {
    const once = togglePlace([], P('/a'));
    expect(once).toEqual([P('/a')]);
    expect(togglePlace(once, P('/a'))).toEqual([]);
  });
});

describe('tags', () => {
  it('parses typed text into unique lowercase tags', () => {
    expect(parseTags(' Work, versable  work,,')).toEqual(['work', 'versable']);
    expect(parseTags('')).toEqual([]);
  });
  it('sets and clears tags on one place', () => {
    const list = [P('/a'), P('/b')];
    const tagged = setTags(list, '/a', ['x']);
    expect(tagged[0].tags).toEqual(['x']);
    expect(tagged[1].tags).toBeUndefined();
    expect(setTags(tagged, '/a', [])[0].tags).toBeUndefined();
  });
  it('reconciles the registry: new tags get palette colours, unused tags drop', () => {
    const list = [P('/a', 'a', ['work']), P('/b', 'b', ['work', 'home'])];
    const tags = reconcileTags(list, [{ name: 'old', color: '#000' }]);
    expect(tags.map(t => t.name)).toEqual(['work', 'home']);
    expect(tags[0].color).toBe(TAG_COLORS[0]);
    expect(tags[1].color).toBe(TAG_COLORS[1]);
    expect(reconcileTags(list, tags)).toEqual(tags);   // stable
  });
  it('cycles a tag colour through the palette', () => {
    const tags = [{ name: 'a', color: TAG_COLORS[TAG_COLORS.length - 1] }];
    expect(cycleTagColor(tags, 'a')[0].color).toBe(TAG_COLORS[0]);
  });
  it('filters by label, path or tag text, case blind; empty text keeps all', () => {
    const list = [P('/Users/me/Code', 'Code'), P('/tmp/w', 'Work stuff', ['work']), P('/h', 'h', ['home'])];
    expect(filterSaved(list, '').length).toBe(3);
    expect(filterSaved(list, 'WORK').map(p => p.path)).toEqual(['/tmp/w']);
    expect(filterSaved(list, 'users').map(p => p.path)).toEqual(['/Users/me/Code']);
    expect(filterSaved(list, 'hom').map(p => p.path)).toEqual(['/h']);
    expect(filterSaved(list, 'zzz')).toEqual([]);
  });
  it('groups untagged first, then by first tag in registry order', () => {
    const list = [P('/u'), P('/w', 'w', ['work']), P('/h', 'h', ['home', 'work'])];
    const tags = [{ name: 'home', color: '#1' }, { name: 'work', color: '#2' }];
    const g = groupByTag(list, tags);
    expect(g.map(x => x.tag?.name ?? null)).toEqual([null, 'home', 'work']);
    expect(g[1].items.map(p => p.path)).toEqual(['/h']);
    expect(g[2].items.map(p => p.path)).toEqual(['/w']);
  });
});

describe('mergeLegacy', () => {
  it('keeps places first with their labels, then bookmarks not already present', () => {
    const out = mergeLegacy(
      [{ path: '/a', label: 'a' }, { path: '/c', label: 'c' }],
      [{ path: '/a', label: 'Alpha' }, { path: '/b', label: 'Bee' }],
    );
    expect(out).toEqual([{ path: '/a', label: 'Alpha' }, { path: '/b', label: 'Bee' }, { path: '/c', label: 'c' }]);
  });
});
