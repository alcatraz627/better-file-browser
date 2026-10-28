import { describe, expect, it } from 'vitest';
import { FIT, clampZoom, zoomAt } from '../src/diagram-tools';

describe('diagram zoom', () => {
  it('keeps the point under the pointer still', () => {
    const at = { x: 120, y: 40 };
    const v = zoomAt(FIT, 2, at);
    expect(v.z).toBe(2);
    // The diagram point under the pointer before and after is the same.
    expect((at.x - v.x) / v.z).toBeCloseTo(at.x);
    expect((at.y - v.y) / v.z).toBeCloseTo(at.y);
    const w = zoomAt(v, 0.5, at);
    expect(w).toEqual({ z: 1, x: 0, y: 0 });
  });

  it('stays between half and eight times', () => {
    expect(clampZoom(0.1)).toBe(0.5);
    expect(clampZoom(20)).toBe(8);
    expect(zoomAt({ z: 8, x: 0, y: 0 }, 2, { x: 0, y: 0 }).z).toBe(8);
  });
});
