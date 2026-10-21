import { describe, it, expect } from 'vitest';
import { pathToHref } from '../src/goto';

describe('pathToHref', () => {
  it.each([
    ['/Users/a/Code', 'file:///Users/a/Code'],
    ['  "/Users/a/My Notes/"  ', 'file:///Users/a/My%20Notes/'],
    ['~/Code', 'file:///Users/a/Code'],
    ['file:///Users/a/x.md', 'file:///Users/a/x.md'],
  ])('%j goes to %s', (input, want) => expect(pathToHref(input, '/Users/a')).toBe(want));
  it('refuses a relative path or ~ with no known home', () => {
    expect(pathToHref('Code/x', '/Users/a')).toBeNull();
    expect(pathToHref('~/x', '')).toBeNull();
  });
});
