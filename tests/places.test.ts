import { describe, it, expect } from 'vitest';
import { upsertPlace, removePlace, renamePlace, movePlace } from '../src/places';
import type { Place } from '../src/types';

const P = (path: string, label = path): Place => ({ path, label });

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
