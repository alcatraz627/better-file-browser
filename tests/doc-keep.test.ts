import { describe, it, expect } from 'vitest';
import { nameProblem } from '../src/doc-keep';
import { retargetPlace } from '../src/places';
import { retargetTabs } from '../src/tabs';

describe('renaming a file: what follows it', () => {
  it('refuses names that would move or hide the file', () => {
    expect(nameProblem('')).toBeTruthy();
    expect(nameProblem('a/b.md')).toBeTruthy();
    expect(nameProblem('..')).toBeTruthy();
    expect(nameProblem('plan v2.md')).toBeNull();
  });
  it('a Saved entry follows the file and keeps a name the person gave it', () => {
    const list = [
      { path: '/n/old.md', label: 'old.md' },
      { path: '/n/other.md', label: 'My plan' },
      { path: '/n/kept.md', label: 'Kept name' },
    ];
    expect(retargetPlace(list, '/n/old.md', '/n/new.md')[0]).toEqual({ path: '/n/new.md', label: 'new.md' });
    expect(retargetPlace(list, '/n/kept.md', '/n/k2.md')[2]).toEqual({ path: '/n/k2.md', label: 'Kept name' });
    expect(retargetPlace(list, '/n/old.md', '/n/new.md')[1]).toBe(list[1]);
  });
  it('a tab follows the file; other tabs are untouched', () => {
    const s = { list: [
      { id: 'a', path: '/n/old.md', kind: 'file' as const, label: 'old.md', pinned: false },
      { id: 'b', path: '/n/', kind: 'folder' as const, label: 'n', pinned: true },
    ], active: 'a' };
    const next = retargetTabs(s, '/n/old.md', '/n/new.md');
    expect(next.list[0]).toEqual({ id: 'a', path: '/n/new.md', kind: 'file', label: 'new.md', pinned: false });
    expect(next.list[1]).toBe(s.list[1]);
    expect(next.active).toBe('a');
    expect(retargetTabs(s, '/x', '/y')).toBe(s);
  });
});
