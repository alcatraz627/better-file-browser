// Turns OpenStreetMap's rail data into the small set of lines and stations the
// metro overlay draws and describes: asking for an area, shrinking the answer,
// merging areas, and working out which lines serve a station.

export interface Station {
  id: number;
  lat: number;
  lng: number;
  name: string;
  local?: string;
  kind: string;
  operator?: string;
  codes?: string[];
  stepFree?: boolean;
}

/** One service as OpenStreetMap records it, usually one direction of a line. */
export interface Route {
  id: number;
  mode: string;
  ref?: string;
  name: string;
  local?: string;
  colour?: string;
  operator?: string;
  from?: string;
  to?: string;
  hours?: string;
  everyMin?: number;
  /** Every stop on the whole route, in order. A stop outside this area has no position. */
  stops: { id: number; lat?: number; lng?: number }[];
  /** Track inside this area, keyed by OpenStreetMap way so areas merge without doubling. */
  ways: Record<string, number[][]>;
}

export interface TransitArea { routes: Route[]; stations: Station[] }

/** A line as a person thinks of it, with its directions merged. */
export interface Line {
  key: string;
  name: string;
  local?: string;
  ref?: string;
  colour: string;
  mode: string;
  operator?: string;
  ends?: string;
  hours?: string;
  everyMin?: number;
  /** Stops in route order, using one direction so each appears once. */
  stops: { id: number; lat?: number; lng?: number }[];
  paths: number[][][];
}

export const TILE_DEGREES = 0.25;
const FALLBACK_COLOUR = '#5f6368';
const SKIP_SERVICES = new Set(['high_speed', 'long_distance', 'night']);

export interface Tile { s: number; w: number; n: number; e: number; key: string }

/** The fixed grid squares covering a view, nearest the centre first. */
export function tilesFor(b: { south: number; west: number; north: number; east: number }): Tile[] {
  const snap = (v: number) => Math.floor(v / TILE_DEGREES) * TILE_DEGREES;
  const out: Tile[] = [];
  for (let s = snap(b.south); s < b.north; s += TILE_DEGREES) {
    for (let w = snap(b.west); w < b.east; w += TILE_DEGREES) {
      const n = s + TILE_DEGREES;
      const e = w + TILE_DEGREES;
      out.push({ s, w, n, e, key: `${s.toFixed(2)},${w.toFixed(2)}` });
    }
  }
  const cy = (b.south + b.north) / 2;
  const cx = (b.west + b.east) / 2;
  const away = (t: Tile) => Math.hypot((t.s + t.n) / 2 - cy, (t.w + t.e) / 2 - cx);
  return out.sort((a, b2) => away(a) - away(b2));
}

/**
 * What to fetch for a square, smallest and most wanted first. Public servers often
 * refuse one big question but answer these three, and stations appear in seconds.
 */
export const STAGES = ['stations', 'metro', 'trains'] as const;
export type Stage = typeof STAGES[number];

/** The Overpass question for one stage of one square. Built only from numbers. */
export function overpassQuery(t: Pick<Tile, 's' | 'w' | 'n' | 'e'>, stage: Stage): string {
  const box = [t.s, t.w, t.n, t.e].map(v => Number(v).toFixed(4)).join(',');
  if (stage === 'stations') return `[out:json][timeout:25];node["railway"="station"](${box});out body;`;
  const routes = stage === 'metro' ? '"route"~"^(subway|light_rail|monorail|tram)$"' : '"route"="train"';
  return `[out:json][timeout:45];relation[${routes}](${box});out geom(${box});`;
}

type Tags = Record<string, string | undefined>;
interface RawMember { type: string; ref: number; role?: string; lat?: number; lon?: number; geometry?: ({ lat: number; lon: number } | null)[] }
interface RawElement { type: string; id: number; lat?: number; lon?: number; tags?: Tags; members?: RawMember[] }

const round = (v: number) => Math.round(v * 1e5) / 1e5;

function stationKind(t: Tags): string {
  const s = t.station;
  if (s === 'subway' || t.subway === 'yes') return 'Metro station';
  if (s === 'light_rail') return 'Light rail station';
  if (s === 'monorail' || t.monorail === 'yes') return 'Monorail station';
  return 'Train station';
}

function simplifyStation(el: RawElement): Station | null {
  const t = el.tags ?? {};
  const name = t['name:en'] || t.name;
  if (el.lat == null || el.lon == null || !name) return null;
  const local = t.name && t.name !== name ? t.name : undefined;
  const operator = t['operator:en'] || t.operator;
  const codes = t.ref?.split(';').map(c => c.trim()).filter(Boolean);
  return {
    id: el.id, lat: round(el.lat), lng: round(el.lon), name, kind: stationKind(t),
    ...(local && { local }),
    ...(operator && { operator }),
    ...(codes?.length && { codes }),
    ...(t.wheelchair === 'yes' && { stepFree: true }),
  };
}

/**
 * Whether a route is a line someone rides across town, not a named express.
 *
 * Mapped trains include every Shinkansen and limited express, which would bury
 * the lines a traveller wants. Those carry neither a line colour nor a short
 * line code, while city lines nearly always have one.
 */
function isCityLine(t: Tags): boolean {
  if (SKIP_SERVICES.has(t.service ?? '')) return false;
  if (t.route !== 'train') return true;
  return !!t.colour || /^[A-Za-z0-9]{1,4}$/.test(t.ref ?? '');
}

function simplifyRoute(el: RawElement): Route | null {
  const t = el.tags ?? {};
  const name = t['name:en'] || t.name;
  if (!name || !t.route || !isCityLine(t)) return null;
  const stops: Route['stops'] = [];
  const ways: Route['ways'] = {};
  for (const m of el.members ?? []) {
    if (m.type === 'node' && /stop/.test(m.role ?? '')) {
      stops.push(m.lat != null && m.lon != null ? { id: m.ref, lat: round(m.lat), lng: round(m.lon) } : { id: m.ref });
    } else if (m.type === 'way' && !/platform/.test(m.role ?? '') && m.geometry) {
      const pts = m.geometry.filter((p): p is { lat: number; lon: number } => !!p).map(p => [round(p.lat), round(p.lon)]);
      if (pts.length > 1) ways[m.ref] = pts;
    }
  }
  const every = Number(t.interval);
  const local = t.name && t.name !== name ? t.name : undefined;
  const operator = t['operator:en'] || t.operator;
  return {
    id: el.id, mode: t.route, name, stops, ways,
    ...(t.ref && { ref: t.ref }),
    ...(local && { local }),
    ...(t.colour && { colour: t.colour }),
    ...(operator && { operator }),
    ...(t.from && { from: t.from }),
    ...(t.to && { to: t.to }),
    ...(t.opening_hours && { hours: t.opening_hours }),
    ...(every > 0 && { everyMin: every }),
  };
}

/** Keeps only what the overlay uses from one Overpass answer. */
export function simplifyArea(raw: { elements?: RawElement[] }): TransitArea {
  const routes: Route[] = [];
  const stations: Station[] = [];
  for (const el of raw.elements ?? []) {
    if (el.type === 'node' && el.tags?.railway === 'station') {
      const s = simplifyStation(el);
      if (s) stations.push(s);
    } else if (el.type === 'relation') {
      const r = simplifyRoute(el);
      if (r) routes.push(r);
    }
  }
  return { routes, stations };
}

/** Adds one square's data to what is already known; each square sees part of a route. */
export function mergeArea(into: TransitArea, add: TransitArea): TransitArea {
  const stations = new Map(into.stations.map(s => [s.id, s]));
  for (const s of add.stations) stations.set(s.id, s);
  const routes = new Map(into.routes.map(r => [r.id, r]));
  for (const r of add.routes) {
    const had = routes.get(r.id);
    if (!had) { routes.set(r.id, r); continue; }
    const known = new Map(r.stops.filter(p => p.lat != null).map(p => [p.id, p]));
    routes.set(r.id, {
      ...had,
      stops: had.stops.map(p => (p.lat != null ? p : known.get(p.id) ?? p)),
      ways: { ...had.ways, ...r.ways },
    });
  }
  return { routes: [...routes.values()], stations: [...stations.values()] };
}

const DIRECTION = /\s*(\(|:|=>|-->|->|→|\bLocal\b).*$/;

/** A route's name without its direction: "Ginza Line (Asakusa --> Shibuya)" reads "Ginza Line". */
export function lineName(name: string): string {
  return name.replace(DIRECTION, '').trim() || name;
}

/** The two ends of a line, from the English name when it carries them. */
function lineEnds(r: Route): string | undefined {
  const m = r.name.match(/(?:\(|:\s*|Local:\s*)\s*([^()]+?)\s*(?:=>|-->|->|→)\s*([^()]+?)\s*\)?$/);
  if (m) return `${m[1]} – ${m[2]}`;
  return r.from && r.to ? `${r.from} – ${r.to}` : undefined;
}

/** A CSS colour from OpenStreetMap's tag, which holds hex or a colour name. */
function safeColour(c: string | undefined): string {
  return c && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(c) ? c : FALLBACK_COLOUR;
}

/**
 * Merges routes into the lines a traveller recognises.
 *
 * A ref holding several codes, such as "DT;Z", is a train running through from
 * one line onto another. Its track is already drawn by those lines, and listing
 * it would bury the real lines under near-duplicates, so it is left out.
 */
export function groupLines(routes: Route[]): Line[] {
  const groups = new Map<string, Route[]>();
  for (const r of routes) {
    if (r.ref?.includes(';') || !Object.keys(r.ways).length) continue;
    const key = r.ref ? `${r.ref}|${safeColour(r.colour).toLowerCase()}` : lineName(r.name).toLowerCase();
    const list = groups.get(key);
    if (list) list.push(r); else groups.set(key, [r]);
  }
  // A same-coded route with no colour is a less complete record of a coloured line.
  const colouredRefs = new Set([...groups.values()].flat().filter(r => r.ref && r.colour).map(r => r.ref));
  for (const [key, list] of groups) {
    if (list.every(r => r.ref && !r.colour && colouredRefs.has(r.ref) && r.mode === 'train')) groups.delete(key);
  }
  return [...groups.entries()].map(([key, list]) => {
    const longest = list.reduce((a, b) => (b.stops.length > a.stops.length ? b : a));
    const ways = new Map<string, number[][]>();
    for (const r of list) for (const [id, pts] of Object.entries(r.ways)) ways.set(id, pts);
    const r0 = list.find(r => lineEnds(r)) ?? longest;
    return {
      key,
      name: lineName(longest.name),
      colour: safeColour(longest.colour),
      mode: longest.mode,
      stops: longest.stops,
      paths: [...ways.values()],
      ...(longest.ref && { ref: longest.ref }),
      ...(longest.local && { local: lineName(longest.local) }),
      ...(longest.operator && { operator: longest.operator }),
      ...(lineEnds(r0) && { ends: lineEnds(r0) }),
      ...(longest.hours && { hours: longest.hours }),
      ...(longest.everyMin && { everyMin: longest.everyMin }),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

const metres = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const x = (aLng - bLng) * 111320 * Math.cos((aLat * Math.PI) / 180);
  const y = (aLat - bLat) * 110540;
  return Math.hypot(x, y);
};

// Wide enough for Tokyo Station, whose Keiyo platforms are mapped over 500 m from
// the rest, and still far closer than two different stations sharing a name.
const SAME_STATION_M = 700;

/**
 * Folds the separate records operators keep for one station into a single stop.
 *
 * Tokyo Station is mapped once for each company serving it. A traveller sees one
 * station, so same-named records close together become one dot with every code.
 */
export function mergeStations(stations: Station[]): Station[] {
  const byName = new Map<string, Station[]>();
  for (const s of stations) {
    const key = s.name.toLowerCase();
    const list = byName.get(key) ?? [];
    const twin = list.find(o => metres(o.lat, o.lng, s.lat, s.lng) <= SAME_STATION_M);
    if (!twin) {
      list.push({ ...s });
      byName.set(key, list);
      continue;
    }
    twin.codes = [...new Set([...(twin.codes ?? []), ...(s.codes ?? [])])];
    if (!twin.codes.length) delete twin.codes;
    if (s.operator && !twin.operator?.split(' · ').includes(s.operator)) {
      twin.operator = twin.operator ? `${twin.operator} · ${s.operator}` : s.operator;
    }
    if (s.kind === 'Metro station') twin.kind = s.kind;
    twin.stepFree ||= s.stepFree;
    if (!twin.stepFree) delete twin.stepFree;
  }
  return [...byName.values()].flat();
}

// A stop is where the train halts, often a platform's length from the point
// mapped as the station itself.
const STOP_REACH_M = 300;

/** The lines that stop at a station. */
export function linesAtStation(station: Station, lines: Line[]): Line[] {
  return lines.filter(l => l.stops.some(p => p.lat != null && p.lng != null
    && metres(station.lat, station.lng, p.lat, p.lng) <= STOP_REACH_M));
}

/** The stations along a line in travel order, from the part of the line loaded. */
export function stationsOnLine(line: Line, stations: Station[]): Station[] {
  const out: Station[] = [];
  for (const p of line.stops) {
    if (p.lat == null || p.lng == null) continue;
    let best: Station | undefined;
    let bestAway = STOP_REACH_M;
    for (const s of stations) {
      const away = metres(s.lat, s.lng, p.lat, p.lng);
      if (away <= bestAway) { best = s; bestAway = away; }
    }
    if (best && !out.includes(best)) out.push(best);
  }
  return out;
}

// Grid cell for finding nearby track quickly; about 500 m.
const CELL = 0.005;

/** Finds which lines run close to a point, fast enough to ask on every mouse move. */
export class TrackIndex {
  private cells = new Map<string, { line: Line; a: number[]; b: number[] }[]>();

  constructor(lines: Line[]) {
    for (const line of lines) {
      for (const path of line.paths) {
        for (let i = 1; i < path.length; i++) this.addSegment(line, path[i - 1], path[i]);
      }
    }
  }

  private addSegment(line: Line, a: number[], b: number[]): void {
    const steps = Math.ceil(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) / CELL) + 1;
    const seen = new Set<string>();
    for (let i = 0; i <= steps; i++) {
      const lat = a[0] + ((b[0] - a[0]) * i) / steps;
      const lng = a[1] + ((b[1] - a[1]) * i) / steps;
      const key = `${Math.floor(lat / CELL)},${Math.floor(lng / CELL)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cell = this.cells.get(key);
      if (cell) cell.push({ line, a, b }); else this.cells.set(key, [{ line, a, b }]);
    }
  }

  /** Lines within reach of the point, nearest first. */
  near(lat: number, lng: number, reachM: number): Line[] {
    const best = new Map<Line, number>();
    const span = Math.min(3, Math.ceil(reachM / 500));
    const cy = Math.floor(lat / CELL);
    const cx = Math.floor(lng / CELL);
    const scale = Math.cos((lat * Math.PI) / 180);
    for (let y = cy - span; y <= cy + span; y++) {
      for (let x = cx - span; x <= cx + span; x++) {
        for (const { line, a, b } of this.cells.get(`${y},${x}`) ?? []) {
          const d = distanceToSegmentM(lat, lng, a, b, scale);
          if (d <= reachM && d < (best.get(line) ?? Infinity)) best.set(line, d);
        }
      }
    }
    return [...best.entries()].sort((p, q) => p[1] - q[1]).map(([line]) => line);
  }
}

function distanceToSegmentM(lat: number, lng: number, a: number[], b: number[], scale: number): number {
  const ax = (a[1] - lng) * 111320 * scale;
  const ay = (a[0] - lat) * 110540;
  const bx = (b[1] - lng) * 111320 * scale;
  const by = (b[0] - lat) * 110540;
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** A station's page on Google Maps: searched by name around its position. */
export function stationMapsUrl(s: Pick<Station, 'name' | 'local' | 'lat' | 'lng'>): string {
  const label = /station/i.test(s.name) ? s.name : `${s.name} Station`;
  return `https://www.google.com/maps/search/${encodeURIComponent(label)}/@${s.lat},${s.lng},16z`;
}

/**
 * The area a line runs through, on Google Maps with transit showing.
 *
 * Google Maps has no page for a line: searching "Oedo Line", "Tokyo Metro Ginza
 * Line" or "都営大江戸線" all answer "can't find". So this frames the line instead.
 */
export function lineMapsUrl(line: Pick<Line, 'paths'>): string {
  const pts = line.paths.flat();
  const lats = pts.map(p => p[0]);
  const lngs = pts.map(p => p[1]);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  // A Google map shows 360 degrees across 256 pixels at zoom 0; assume about 900 pixels of window.
  const span = Math.max(north - south, east - west, 0.001);
  const zoom = Math.max(9, Math.min(15, Math.floor(Math.log2((900 * 360) / (256 * span)))));
  return `https://www.google.com/maps/@${((south + north) / 2).toFixed(5)},${((west + east) / 2).toFixed(5)},${zoom}z/data=!5m1!1e2`;
}
