import { describe, expect, it } from 'vitest';
import { findMapFor } from '../src/site-metro-model';

function fakeMap(div: Element) {
  return { getBounds: () => null, getZoom: () => 13, getDiv: () => div };
}

/** Builds wrapper > mapEl with a React fiber on the wrapper, as the real sites have. */
function pageWith(state: unknown) {
  const wrapper = document.createElement('div');
  const mapEl = document.createElement('div');
  wrapper.append(mapEl);
  (wrapper as unknown as Record<string, unknown>).__reactFiber$abc = {
    memoizedProps: {},
    memoizedState: null,
    return: { memoizedProps: {}, memoizedState: state, return: null },
  };
  return { wrapper, mapEl };
}

describe('findMapFor', () => {
  it('finds a map held in React state, as Booking keeps it', () => {
    const holder: { memoizedState: unknown } = { memoizedState: null };
    const { wrapper, mapEl } = pageWith(holder);
    const map = fakeMap(wrapper);
    holder.memoizedState = { impl: { map } };
    expect(findMapFor(mapEl)).toBe(map);
  });

  it('finds a map held in a context value, as Airbnb keeps it', () => {
    const holder: { children: unknown[] } = { children: [] };
    const { wrapper, mapEl } = pageWith(holder);
    const map = fakeMap(wrapper);
    holder.children = [{ props: { value: { map } } }];
    expect(findMapFor(mapEl)).toBe(map);
  });

  it('skips a map that belongs to another element', () => {
    const holder: { map: unknown } = { map: null };
    const { mapEl } = pageWith(holder);
    holder.map = fakeMap(document.createElement('div'));
    expect(findMapFor(mapEl)).toBeNull();
  });

  it('survives a tree that loops back on itself', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    const { mapEl } = pageWith(loop);
    expect(findMapFor(mapEl)).toBeNull();
  });

  it('returns nothing on a page with no React', () => {
    expect(findMapFor(document.createElement('div'))).toBeNull();
  });
});
