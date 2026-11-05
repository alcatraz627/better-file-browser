import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  groupLines, lineMapsUrl, lineName, linesAtStation, mergeArea, mergeStations, overpassQuery,
  simplifyArea, stationMapsUrl, stationsOnLine, tilesFor, TrackIndex, type Route,
} from '../src/site-transit-data';

// A trimmed real Overpass answer for central Tokyo.
const raw = JSON.parse(readFileSync('e2e/fixtures/overpass-tokyo.json', 'utf8'));
const area = simplifyArea(raw);
const lines = groupLines(area.routes);
const stations = mergeStations(area.stations);
const line = (ref: string) => lines.find(l => l.ref === ref)!;
const station = (name: string) => stations.find(s => s.name === name)!;

describe('choosing which lines to show', () => {
  it('merges each direction into one line a traveller recognises', () => {
    expect(lines.map(l => l.ref).sort()).toEqual(['E', 'G', 'JE', 'JY']);
    expect(line('G').name).toBe('Tokyo Metro Ginza Line');
    expect(line('G').colour).toMatch(/^#/);
    expect(line('G').ends).toMatch(/Asakusa|Shibuya/);
  });

  it('leaves out named expresses', () => {
    expect(area.routes.some(r => /Nozomi/.test(r.name))).toBe(false);
  });

  it('leaves out a through service, whose track its own lines already draw', () => {
    expect(area.routes.some(r => r.ref === 'DT;Z')).toBe(true);
    expect(lines.some(l => l.ref === 'DT;Z')).toBe(false);
  });

  it('drops a colourless record of a line that has a coloured one', () => {
    const route = (id: number, colour?: string): Route => ({
      id, mode: 'train', ref: 'JU', name: `Utsunomiya ${id}`, stops: [], ways: { [id]: [[35, 139], [35.1, 139.1]] }, ...(colour && { colour }),
    });
    const merged = groupLines([route(1), route(2, '#f68b1e')]);
    expect(merged.map(l => l.colour)).toEqual(['#f68b1e']);
  });

  it('ignores a colour tag that is not a plain colour', () => {
    const merged = groupLines([{
      id: 1, mode: 'subway', name: 'X', colour: 'red;background:url(x)', stops: [], ways: { 1: [[35, 139], [35.1, 139.1]] },
    }]);
    expect(merged[0].colour).toBe('#5f6368');
  });

  it('reads the line out of a name carrying its direction', () => {
    expect(lineName('Shinjuku Line (Motoyawata --> Shinjuku)')).toBe('Shinjuku Line');
    expect(lineName('Tokyo Metro Tōzai Line Local: Nakano => Nishi-Funabashi')).toBe('Tokyo Metro Tōzai Line');
    expect(lineName('都営新宿線 : 本八幡→新宿')).toBe('都営新宿線');
    expect(lineName('Oedo Line')).toBe('Oedo Line');
  });
});

describe('stations', () => {
  it('folds each operator\'s record of one station into a single stop', () => {
    expect(area.stations.filter(s => s.name === 'Tokyo').length).toBeGreaterThan(1);
    expect(stations.filter(s => s.name === 'Tokyo')).toHaveLength(1);
    expect(station('Tokyo').codes!.length).toBeGreaterThan(1);
  });

  it('keeps same-named stations in different places apart', () => {
    const a = { id: 1, lat: 35.6, lng: 139.7, name: 'Central', kind: 'Metro station' };
    expect(mergeStations([a, { ...a, id: 2, lat: 35.9 }])).toHaveLength(2);
  });

  it('knows the lines at a station', () => {
    expect(linesAtStation(station('Monzen-nakacho'), lines).map(l => l.ref)).toContain('E');
    expect(linesAtStation(station('Shiomi'), lines).map(l => l.ref)).toEqual(['JE']);
    expect(linesAtStation(station('Ginza'), lines).map(l => l.ref)).toContain('G');
  });

  it('lists a line\'s stations in travel order', () => {
    const names = stationsOnLine(line('G'), stations).map(s => s.name);
    const inOrder = ['Kanda', 'Mitsukoshimae', 'Nihombashi', 'Kyobashi', 'Ginza', 'Shimbashi'];
    expect(names.filter(n => inOrder.includes(n))).toEqual(inOrder);
  });
});

describe('finding track under the pointer', () => {
  const index = new TrackIndex(lines);
  const point = line('G').paths[0][0];

  it('finds a line when the pointer is on it', () => {
    expect(index.near(point[0], point[1], 30).map(l => l.ref)).toContain('G');
  });

  it('finds nothing in the sea', () => {
    expect(index.near(35.6, 139.95, 100)).toEqual([]);
  });

  it('finds nothing just out of reach', () => {
    expect(index.near(point[0] + 0.01, point[1] + 0.01, 30).map(l => l.ref)).not.toContain('G');
  });
});

describe('fetching areas', () => {
  it('covers a view with fixed squares, nearest the middle first', () => {
    const tiles = tilesFor({ south: 35.7, west: 139.7, north: 35.9, east: 139.85 });
    expect(tiles.map(t => t.key)).toContain('35.50,139.50');
    expect(tiles).toHaveLength(4);
    expect(tiles[0].key).toBe('35.75,139.75');
    // The same place always falls in the same square, so the cache can find it.
    expect(tilesFor({ south: 35.67, west: 139.76, north: 35.68, east: 139.77 })[0].key).toBe('35.50,139.75');
  });

  it('builds its question from numbers alone', () => {
    const q = overpassQuery({ s: 35.5, w: 139.75, n: 35.75, e: 140 }, 'stations');
    expect(q).toContain('(35.5000,139.7500,35.7500,140.0000)');
    expect(overpassQuery({ s: '1);evil' as unknown as number, w: 0, n: 0, e: 0 }, 'stations')).toContain('NaN');
  });

  it('asks for stations, metro and trains separately', () => {
    const tile = { s: 35.5, w: 139.75, n: 35.75, e: 140 };
    expect(overpassQuery(tile, 'stations')).toContain('node["railway"="station"]');
    expect(overpassQuery(tile, 'stations')).not.toContain('relation');
    expect(overpassQuery(tile, 'metro')).toContain('subway');
    expect(overpassQuery(tile, 'metro')).not.toContain('"train"');
    expect(overpassQuery(tile, 'trains')).toContain('"route"="train"');
  });

  it('joins the pieces of a route seen from two squares', () => {
    const base = { id: 9, mode: 'subway', name: 'L' };
    const a: Route = { ...base, stops: [{ id: 1, lat: 35, lng: 139 }, { id: 2 }], ways: { 10: [[35, 139], [35.1, 139]] } };
    const b: Route = { ...base, stops: [{ id: 1 }, { id: 2, lat: 36, lng: 139 }], ways: { 11: [[35.9, 139], [36, 139]] } };
    const merged = mergeArea({ routes: [a], stations: [] }, { routes: [b], stations: [] });
    expect(merged.routes).toHaveLength(1);
    expect(merged.routes[0].stops).toEqual([{ id: 1, lat: 35, lng: 139 }, { id: 2, lat: 36, lng: 139 }]);
    expect(Object.keys(merged.routes[0].ways)).toEqual(['10', '11']);
  });

  it('copes with an empty answer', () => {
    expect(simplifyArea({})).toEqual({ routes: [], stations: [] });
  });
});

describe('Google Maps links', () => {
  it('searches for a station by name around its place', () => {
    const url = stationMapsUrl({ name: 'Shiomi', lat: 35.65892, lng: 139.8172 });
    expect(url).toBe('https://www.google.com/maps/search/Shiomi%20Station/@35.65892,139.8172,16z');
  });

  it('does not say Station twice', () => {
    expect(stationMapsUrl({ name: 'Tokyo Station', lat: 35, lng: 139 })).toContain('/Tokyo%20Station/');
  });

  it('frames a whole line with transit showing, because Google has no page for a line', () => {
    const url = lineMapsUrl({ paths: [[[35.6, 139.7], [35.7, 139.8]]] });
    expect(url).toBe('https://www.google.com/maps/@35.65000,139.75000,13z/data=!5m1!1e2');
    expect(url).not.toContain('/search/');
  });

  it('keeps a very long line and a tiny one at a usable zoom', () => {
    expect(lineMapsUrl({ paths: [[[30, 130], [40, 140]]] })).toContain(',9z/');
    expect(lineMapsUrl({ paths: [[[35.6, 139.7], [35.6001, 139.7001]]] })).toContain(',15z/');
  });

  it('escapes a name that could break out of the path', () => {
    expect(stationMapsUrl({ name: 'A/B?c', lat: 1, lng: 2 })).toContain('A%2FB%3Fc');
  });
});
