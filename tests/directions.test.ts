import { describe, it, expect } from 'vitest';
import { rowState, tally, isDirectionsDoc, isMarkKey } from '../src/directions';
import { registerDocView, docViewsFor } from '../src/docview';

describe('directions docs', () => {
  it('knows a directions doc by its name', () => {
    expect(isDirectionsDoc('/a/docs/plan/DIRECTIONS.md')).toBe(true);
    expect(isDirectionsDoc('/a/notes/extractor-and-e2e-directions.md')).toBe(true);
    expect(isDirectionsDoc('/a/directions/readme.md')).toBe(false);
    expect(isDirectionsDoc('/a/README.md')).toBe(false);
  });
  it('takes the first state mark in a row, wherever it sits', () => {
    expect(rowState('`T1` 🔴 Two-person approval')).toBe('needs');
    expect(rowState('H3 | why | 🟠 app #365 draft, then 🟢 later')).toBe('waiting');
    expect(rowState('done ✅')).toBe('done');
    expect(rowState('5 | Logging | ⏸ | 💤 parked')).toBe('parked');
    expect(rowState('no mark here')).toBeNull();
  });
  it('counts rows per state', () => {
    expect(tally(['ready', 'ready', 'needs', null, 'done'])).toEqual({ needs: 1, waiting: 0, ready: 2, parked: 0, done: 1 });
  });
  it("knows the doc's key to its marks, and only that", () => {
    expect(isMarkKey('Marks: 🔴 needs you · 🟠 waiting on someone · 🟢 ready for an agent')).toBe(true);
    expect(isMarkKey('Marks: 🔴 only one')).toBe(false);
    expect(isMarkKey('The 🔴 🟠 🟢 rows are below')).toBe(false);
  });
});

describe('doc views', () => {
  it('hands a path only to the views of its kind that claim it, once per id', () => {
    registerDocView({ id: 't-file', on: 'file', claims: p => p.endsWith('.md'), mount: () => true });
    registerDocView({ id: 't-folder', on: 'folder', claims: (p, names) => names.includes('config.json'), mount: () => true });
    registerDocView({ id: 't-file', on: 'file', claims: () => true, mount: () => true });
    expect(docViewsFor('file', '/a/x.md').map(v => v.id)).toEqual(['t-file']);
    expect(docViewsFor('file', '/a/x.txt')).toEqual([]);
    expect(docViewsFor('folder', '/a/', ['config.json']).map(v => v.id)).toEqual(['t-folder']);
    expect(docViewsFor('folder', '/a/', ['x'])).toEqual([]);
  });
});
