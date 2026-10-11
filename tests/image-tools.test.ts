import { describe, it, expect } from 'vitest';
import { turnedSize, fitZoom, clampZoom, viewTransform, START_VIEW } from '../src/image-tools';

describe('image tools', () => {
  it('a quarter turn swaps width and height; a half turn does not', () => {
    expect(turnedSize(400, 200, 0)).toEqual({ w: 400, h: 200 });
    expect(turnedSize(400, 200, 90)).toEqual({ w: 200, h: 400 });
    expect(turnedSize(400, 200, 180)).toEqual({ w: 400, h: 200 });
    expect(turnedSize(400, 200, 270)).toEqual({ w: 200, h: 400 });
  });
  it('fit shrinks to the stage, never enlarges past 100%, and follows the turn', () => {
    expect(fitZoom(2000, 1000, 0, 1032, 532)).toBeCloseTo(0.5);
    expect(fitZoom(100, 50, 0, 1000, 800)).toBe(1);
    expect(fitZoom(2000, 1000, 90, 1032, 532)).toBeCloseTo(0.25);
    expect(fitZoom(1000, 2000, 90, 1032, 532)).toBeCloseTo(0.5);
    expect(fitZoom(0, 0, 0, 100, 100)).toBe(1);
  });
  it('zoom stays between 5% and 1600%', () => {
    expect(clampZoom(0.001)).toBe(0.05);
    expect(clampZoom(99)).toBe(16);
    expect(clampZoom(1.25)).toBe(1.25);
  });
  it('the flip mirrors the screen after the turn', () => {
    expect(viewTransform(START_VIEW)).toBe('translate(-50%,-50%) scaleX(1) rotate(0deg)');
    expect(viewTransform({ ...START_VIEW, rot: 90, flip: true })).toBe('translate(-50%,-50%) scaleX(-1) rotate(90deg)');
  });
});
