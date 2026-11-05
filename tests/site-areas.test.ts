import { describe, it, expect } from 'vitest';
import { AREAS, KIND_COLOUR, KIND_ORDER, KIND_WORD, type Area, type AreaKind } from '../src/site-areas-data';
import { eventDates, filterAreas, labelsThatFit } from '../src/site-areas-model';

const area = (id: string, kinds: AreaKind[], events = 0): Area => ({
  id, name: id, lat: 0, lng: 0, radiusM: 1, kinds, tag: '', feel: '',
  events: Array.from({ length: events }, () => ({ name: 'e', start: '2026-11-14', end: '2026-11-14', note: '', source: '', sure: true })),
});

describe('filtering areas', () => {
  const all = [area('a', ['market']), area('b', ['temple', 'night'], 2), area('c', ['shop'])];
  const ids = (kinds: AreaKind[], eventsOnly = false) => filterAreas(all, new Set(kinds), eventsOnly).map(a => a.id);
  it('keeps everything until a kind is chosen', () => expect(ids([])).toEqual(['a', 'b', 'c']));
  it('keeps an area with any chosen kind', () => expect(ids(['night', 'shop'])).toEqual(['b', 'c']));
  it('can keep only areas with events, alone or with a kind', () => {
    expect(ids([], true)).toEqual(['b']);
    expect(ids(['market'], true)).toEqual([]);
  });
});

describe('event dates in words', () => {
  it('names the weekday of a single day', () => expect(eventDates({ start: '2026-11-17', end: '2026-11-17' })).toBe('Tue Nov 17'));
  it('shortens a run within a month', () => expect(eventDates({ start: '2026-11-14', end: '2026-11-15' })).toBe('Nov 14 to 15'));
  it('names both months across months and years', () => expect(eventDates({ start: '2026-11-12', end: '2027-02-14' })).toBe('Nov 12 to Feb 14'));
});

describe('labels on the map', () => {
  const box = (id: string, x: number) => ({ id, x, y: 0, w: 100, fullW: 300, h: 20 });
  it('keeps the earlier of two that collide, and any that fit', () => {
    expect([...labelsThatFit([box('first', 0), box('second', 50), box('third', 200)]).keys()]).toEqual(['first', 'third']);
  });
  it('gives a label its full text only where it has room', () => {
    const fit = labelsThatFit([box('a', 0), box('b', 150), box('c', 1000)]);
    expect([fit.get('a'), fit.get('b'), fit.get('c')]).toEqual([false, false, true]);
  });
  it('a full label takes the room, so its neighbour stays short', () => {
    const fit = labelsThatFit([box('a', 0), box('b', 250)]);
    expect([fit.get('a'), fit.get('b')]).toEqual([true, false]);
  });
});

describe('the hand-fed data', () => {
  const TRIP_START = '2026-11-12', TRIP_END = '2026-11-17';
  it('every event overlaps the trip, with its dates in order', () => {
    for (const a of AREAS) for (const e of a.events) {
      expect(e.start <= e.end, e.name).toBe(true);
      expect(e.start <= TRIP_END && e.end >= TRIP_START, e.name).toBe(true);
      expect(e.source, e.name).toMatch(/^https:\/\//);
    }
  });
  it('every area has a place on the map, a kind with a colour and a word, and a short label', () => {
    expect(new Set(AREAS.map(a => a.id)).size).toBe(AREAS.length);
    for (const a of AREAS) {
      expect(a.lat, a.id).toBeGreaterThan(34.9);
      expect(a.lat, a.id).toBeLessThan(37);
      expect(a.lng, a.id).toBeGreaterThan(138.5);
      expect(a.lng, a.id).toBeLessThan(140.5);
      expect(a.kinds.length, a.id).toBeGreaterThan(0);
      for (const k of a.kinds) { expect(KIND_ORDER).toContain(k); expect(KIND_COLOUR[k]).toBeTruthy(); expect(KIND_WORD[k]).toBeTruthy(); }
      expect(a.tag.length, a.id).toBeLessThanOrEqual(32);
    }
  });
});
