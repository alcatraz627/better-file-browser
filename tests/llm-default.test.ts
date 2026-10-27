import { describe, it, expect } from 'vitest';
import { defaultTier } from '../src/llm';

describe('defaultTier', () => {
  const tiers = [{ alias: 'fast', model: 'qwen2.5-coder:7b' }, { alias: 'code', model: 'qwen2.5-coder:7b' }, { alias: 'big', model: 'gemma4:26b' }];
  it('marks one row when two names share the default model', () => {
    expect(defaultTier(tiers, 'qwen2.5-coder:7b')).toBe(0);
  });
  it('prefers the row whose name is the default', () => {
    expect(defaultTier(tiers, 'code')).toBe(1);
  });
  it('ignores a :latest suffix, and finds none for an unlisted or empty default', () => {
    expect(defaultTier([{ alias: 'g', model: 'gemma4:latest' }], 'gemma4')).toBe(0);
    expect(defaultTier(tiers, 'other')).toBe(-1);
    expect(defaultTier(tiers, '')).toBe(-1);
  });
});
