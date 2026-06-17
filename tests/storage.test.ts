import { describe, it, expect, beforeEach } from 'vitest';
import { getColWidths, saveColWidths } from '../src/storage';

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
