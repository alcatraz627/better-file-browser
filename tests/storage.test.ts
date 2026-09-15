import { describe, it, expect, beforeEach } from 'vitest';
import {
  getColWidths, saveColWidths, getSettings, saveSettings,
  getSortConfig, saveSortConfig, getGroupMode, saveGroupMode,
  getPreviewLayout, savePreviewLayout,
} from '../src/storage';

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
