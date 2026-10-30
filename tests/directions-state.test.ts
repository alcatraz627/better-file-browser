import { describe, it, expect } from 'vitest';
import { defaultFilter, filterFromHash, hashFor, startFilter, isFiltered, ownsHash } from '../src/directions-state';

describe('directions filter in the address', () => {
  it('writes nothing for the default, so a plain doc keeps a plain address', () => {
    expect(hashFor(defaultFilter())).toBe('');
  });
  it('round-trips every part', () => {
    const f = { layout: 'list' as const, depth: 'overview' as const, states: new Set(['waiting', 'needs'] as const), q: 'moisture sensor' };
    const h = hashFor(f);
    expect(h).toBe('#dir?layout=list&depth=overview&s=needs,waiting&q=moisture+sensor');
    const back = filterFromHash(h)!;
    expect(back.layout).toBe('list');
    expect(back.depth).toBe('overview');
    expect([...back.states!]).toEqual(['needs', 'waiting']);
    expect(back.q).toBe('moisture sensor');
  });
  it('ignores a heading or comment address and unknown values', () => {
    expect(filterFromHash('#where-things-stand')).toBeNull();
    expect(filterFromHash('#c=t-123')).toBeNull();
    const odd = filterFromHash('#dir?layout=grid&s=needs,bogus')!;
    expect(odd.layout).toBeUndefined();
    expect([...odd.states!]).toEqual(['needs']);
  });
  it('starts from the address, then the doc\'s remembered choice, then the defaults', () => {
    expect(startFilter('', {})).toEqual(defaultFilter());
    expect(startFilter('', { layout: 'list', depth: 'overview' })).toMatchObject({ layout: 'list', depth: 'overview' });
    const f = startFilter('#dir?s=ready', { layout: 'list', depth: 'overview' });
    expect(f.layout).toBe('list');
    expect([...f.states]).toEqual(['ready']);
    expect(startFilter('#dir?layout=doc', { layout: 'list' }).layout).toBe('doc');
  });
  it('knows what counts as filtered and which addresses it may rewrite', () => {
    expect(isFiltered({ ...defaultFilter(), depth: 'overview' })).toBe(false);
    expect(isFiltered({ ...defaultFilter(), q: ' x ' })).toBe(true);
    expect(ownsHash('#c=t-1')).toBe(false);
    expect(ownsHash('#seeds')).toBe(true);
  });
});
