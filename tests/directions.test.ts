import { describe, it, expect } from 'vitest';
import { rowState, tally, isDirectionsDoc } from '../src/directions';

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
});
