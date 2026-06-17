import { describe, it, expect } from 'vitest';
import { selectionRange } from '../src/selection';

describe('selectionRange', () => {
  it('returns the inclusive range ascending', () => {
    expect(selectionRange(2, 5)).toEqual([2, 3, 4, 5]);
  });
  it('is order-agnostic (anchor after target)', () => {
    expect(selectionRange(5, 2)).toEqual([2, 3, 4, 5]);
  });
  it('returns a single index when anchor === target', () => {
    expect(selectionRange(3, 3)).toEqual([3]);
  });
  it('handles adjacent indices', () => {
    expect(selectionRange(0, 1)).toEqual([0, 1]);
  });
});
