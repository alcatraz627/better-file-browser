import { describe, expect, it } from 'vitest';
import { collapseSpace, collapsedIndex, findQuote, makeQuote, pageKey } from '../src/site-marks-anchor';

describe('collapseSpace', () => {
  it('collapses runs and keeps each character mapped to its raw place', () => {
    const m = collapseSpace('  a \n\t b  c');
    expect(m.s).toBe('a b c');
    expect(m.o).toEqual([2, 3, 7, 8, 10]);
    expect(collapsedIndex(m, 7)).toBe(2);
    expect(collapsedIndex(m, 5)).toBe(2);
  });
});

describe('findQuote', () => {
  const page = 'The cat sat. Then the dog sat. Later the cat sat again.';

  it('finds the right copy of a repeated phrase by its surroundings', () => {
    const second = page.lastIndexOf('the cat sat');
    const q = makeQuote(page, second, second + 'the cat sat'.length);
    expect(findQuote(page, q)).toEqual({ start: second, end: second + 11 });
  });

  it('still finds it after text is added above', () => {
    const at = page.indexOf('the dog');
    const q = makeQuote(page, at, at + 7);
    const changed = 'A new opening line. ' + page;
    expect(findQuote(changed, q)?.start).toBe(changed.indexOf('the dog'));
  });

  it('gives up when the words are gone', () => {
    const q = makeQuote(page, 0, 7);
    expect(findQuote('nothing like it', q)).toBeNull();
  });
});

describe('pageKey', () => {
  it('drops tracking and plain fragments but keeps app routes', () => {
    expect(pageKey('https://a.com/x?utm_source=t&b=2&a=1#top')).toBe('https://a.com/x?a=1&b=2');
    expect(pageKey('https://a.com/app#/inbox/3')).toBe('https://a.com/app#/inbox/3');
    expect(pageKey('https://a.com/?fbclid=zz')).toBe('https://a.com/');
  });
});
