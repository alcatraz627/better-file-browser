import { describe, it, expect, beforeEach } from 'vitest';
import {
  getColWidths, saveColWidths, getSettings, saveSettings,
  getSortConfig, saveSortConfig, getGroupMode, saveGroupMode,
  getPreviewLayout, savePreviewLayout,
  getSaved, saveSaved, getTags, saveTags,
} from '../src/storage';

describe('saved folders storage', () => {
  beforeEach(() => localStorage.clear());

  it('migrates the old bookmarks and places keys once, leaving them in place', () => {
    localStorage.setItem('bfb-bookmarks-v2', JSON.stringify([{ path: '/a', label: 'a' }, { path: '/c', label: 'c' }]));
    localStorage.setItem('bfb-places-v1', JSON.stringify([{ path: '/a', label: 'Alpha' }, { path: '/b', label: 'Bee' }]));
    expect(getSaved().map(p => p.label)).toEqual(['Alpha', 'Bee', 'c']);
    expect(localStorage.getItem('bfb-saved-v1')).not.toBeNull();
    expect(localStorage.getItem('bfb-bookmarks-v2')).not.toBeNull();
    localStorage.setItem('bfb-bookmarks-v2', '[]');
    expect(getSaved().length).toBe(3);   // migration does not re-run
  });

  it('starts empty with no legacy keys and round-trips a save', () => {
    expect(getSaved()).toEqual([]);
    saveSaved([{ path: '/x', label: 'X', tags: ['work'] }]);
    expect(getSaved()[0].tags).toEqual(['work']);
  });

  it('keeps the tag registry in step with the tags in use', () => {
    saveSaved([{ path: '/x', label: 'X', tags: ['work'] }]);
    expect(getTags().map(t => t.name)).toEqual(['work']);
    saveTags([{ name: 'work', color: '#abcdef' }]);
    expect(getTags()[0].color).toBe('#abcdef');
    saveSaved([{ path: '/x', label: 'X' }]);
    expect(getTags()).toEqual([]);
  });

  it('tolerates corrupt JSON in any key', () => {
    localStorage.setItem('bfb-saved-v1', '{nope');
    expect(getSaved()).toEqual([]);
  });
});

describe('preview layout persistence', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to a modal with no remembered sizes', () => {
    expect(getPreviewLayout()).toEqual({ mode: 'modal' });
  });

  it('round-trips mode and sizes, rounding to whole pixels', () => {
    savePreviewLayout({ mode: 'side', sideW: 411.6, modalW: 900, modalH: 640 });
    expect(getPreviewLayout()).toEqual({ mode: 'side', sideW: 412, modalW: 900, modalH: 640 });
  });

  it('drops an unknown mode or a nonsense size', () => {
    localStorage.setItem('bfb-preview-layout-v1', JSON.stringify({ mode: 'popup', sideW: 300 }));
    expect(getPreviewLayout()).toEqual({ mode: 'modal' });
    localStorage.setItem('bfb-preview-layout-v1', JSON.stringify({ mode: 'side', sideW: -5, modalW: 'wide' }));
    expect(getPreviewLayout()).toEqual({ mode: 'side' });
  });
});

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
