import { describe, it, expect, beforeEach } from 'vitest';
import {
  getColWidths, saveColWidths, getSettings, saveSettings,
  getSortConfig, saveSortConfig, getGroupMode, saveGroupMode,
} from '../src/storage';

describe('sort + group persistence', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to unsorted, ungrouped', () => {
    expect(getSortConfig()).toEqual({ col: null, dir: 'asc' });
    expect(getGroupMode()).toBe('none');
  });

  it('round-trips a sort and a group', () => {
    saveSortConfig({ col: 'size', dir: 'desc' });
    saveGroupMode('folders-first');
    expect(getSortConfig()).toEqual({ col: 'size', dir: 'desc' });
    expect(getGroupMode()).toBe('folders-first');
  });

  it('rejects unknown columns, directions, modes and corrupt JSON', () => {
    localStorage.setItem('bfb-sort-v1', JSON.stringify({ col: 'owner', dir: 'asc' }));
    expect(getSortConfig()).toEqual({ col: null, dir: 'asc' });
    localStorage.setItem('bfb-sort-v1', JSON.stringify({ col: 'name', dir: 'sideways' }));
    expect(getSortConfig()).toEqual({ col: null, dir: 'asc' });
    localStorage.setItem('bfb-sort-v1', '{oops');
    expect(getSortConfig()).toEqual({ col: null, dir: 'asc' });
    localStorage.setItem('bfb-group-v1', 'by-mood');
    expect(getGroupMode()).toBe('none');
  });
});

describe('column widths storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns an empty object when nothing is stored', () => {
    expect(getColWidths()).toEqual({});
  });

  it('round-trips saved widths', () => {
    saveColWidths({ nm: 300, sz: 90 });
    expect(getColWidths()).toEqual({ nm: 300, sz: 90 });
  });

  it('tolerates corrupt JSON', () => {
    localStorage.setItem('bfb-col-widths-v1', '{not json');
    expect(getColWidths()).toEqual({});
  });
});

describe('settings storage (aiModel)', () => {
  beforeEach(() => localStorage.clear());
  it('defaults aiModel to undefined and round-trips a chosen model', () => {
    expect(getSettings().aiModel).toBeUndefined();
    saveSettings({ ...getSettings(), aiModel: 'qwen2.5-coder:3b' });
    expect(getSettings().aiModel).toBe('qwen2.5-coder:3b');
  });
});
