import { describe, it, expect, beforeEach } from 'vitest';
import { getColWidths, saveColWidths, getSettings, saveSettings } from '../src/storage';

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
