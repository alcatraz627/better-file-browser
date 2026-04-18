import { describe, it, expect } from 'vitest';
import { applyFilter, applySort, buildGroups } from '../src/sort-filter';
import type { Entry } from '../src/types';

const file = (name: string, rawBytes = 0, dateStr = '2024-01-01'): Entry =>
  ({ name, href: name, isDir: false, isParent: false, isHidden: name.startsWith('.'), rawBytes, dateStr });
const dir = (name: string): Entry =>
  ({ name, href: name + '/', isDir: true, isParent: false, isHidden: false, rawBytes: -1, dateStr: '2024-01-01' });

const ENTRIES: Entry[] = [
  dir('src'),
  dir('docs'),
  file('readme.md', 1024),
  file('build.ts', 512),
  file('.gitignore', 200),
  file('image.PNG', 4096),
];

describe('applyFilter', () => {
  it('passes all entries for type=all with no query', () => {
    expect(applyFilter(ENTRIES, { type: 'all', q: '', regex: false })).toHaveLength(ENTRIES.length);
  });

  it('filters to folders only', () => {
    const result = applyFilter(ENTRIES, { type: 'folders', q: '', regex: false });
    expect(result.every(e => e.isDir)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('filters to files only', () => {
    const result = applyFilter(ENTRIES, { type: 'files', q: '', regex: false });
    expect(result.every(e => !e.isDir)).toBe(true);
    expect(result).toHaveLength(4);
  });

  it('filters by extension', () => {
    const result = applyFilter(ENTRIES, { type: 'md', q: '', regex: false });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('readme.md');
  });

  it('filters by plain text query', () => {
    const result = applyFilter(ENTRIES, { type: 'all', q: 'build', regex: false });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('build.ts');
  });

  it('filters by regex query', () => {
    const result = applyFilter(ENTRIES, { type: 'all', q: '\\.(md|ts)$', regex: true });
    expect(result).toHaveLength(2);
  });

  it('silently skips invalid regex', () => {
    const result = applyFilter(ENTRIES, { type: 'all', q: '[invalid', regex: true });
    expect(result).toHaveLength(ENTRIES.length);
  });
});

describe('applySort', () => {
  it('no-ops when col is null', () => {
    const result = applySort(ENTRIES, { col: null, dir: 'asc' });
    expect(result).toEqual(ENTRIES);
  });

  it('sorts by name ascending', () => {
    const result = applySort(ENTRIES, { col: 'name', dir: 'asc' });
    const names = result.map(e => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('sorts by name descending', () => {
    const result = applySort(ENTRIES, { col: 'name', dir: 'desc' });
    expect(result[0].name > result[result.length - 1].name).toBe(true);
  });

  it('sorts by size', () => {
    const result = applySort(ENTRIES, { col: 'size', dir: 'asc' });
    const sizes = result.map(e => e.rawBytes);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
  });

  it('does not mutate original array', () => {
    const original = [...ENTRIES];
    applySort(ENTRIES, { col: 'name', dir: 'asc' });
    expect(ENTRIES).toEqual(original);
  });
});

describe('buildGroups', () => {
  it('folders-first splits correctly', () => {
    const groups = buildGroups(ENTRIES, 'folders-first');
    expect(groups[0].label).toMatch(/Folder/);
    expect(groups[1].label).toMatch(/File/);
  });

  it('files-first splits correctly', () => {
    const groups = buildGroups(ENTRIES, 'files-first');
    expect(groups[0].label).toMatch(/File/);
  });

  it('ext groups by extension', () => {
    const groups = buildGroups(ENTRIES, 'ext');
    const keys = groups.map(g => g.label);
    expect(keys).toContain('.md');
    expect(keys).toContain('.ts');
  });

  it('none mode returns single All group', () => {
    const groups = buildGroups(ENTRIES, 'none');
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('All');
  });
});
