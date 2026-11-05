// A switch on Booking and Airbnb maps that shows metro and rail lines with their
// stations. Hovering names a line or station, and clicking opens a popup with its
// details and a link to Google Maps.
//
// Google's transit layer paints the lines at once, but only as pictures. The dots,
// the hovering and the details come from OpenStreetMap data fetched by
// site-bridge.ts, so they arrive a little later, the first time an area is viewed.

import { findMapFor, type MapLike } from './site-metro-model';
import {
  areaCard, areaTip, chooserCard, lineCard, lineTip, METRO_CSS, stationCard, stationTip, type CardContext,
} from './site-metro-cards';
import { AREAS, KIND_COLOUR, KIND_ORDER, KIND_WORD, type Area, type AreaKind } from './site-areas-data';
import { filterAreas, labelsThatFit } from './site-areas-model';
import {
  groupLines, linesAtStation, mergeArea, mergeStations, STAGES, stationsOnLine, tilesFor, TrackIndex,
  type Line, type Stage, type Station, type Tile, type TransitArea,
} from './site-transit-data';

const STORE_KEY = 'bfbMetroOn';
const CHECK_MS = 1000;
const MAX_TRIES = 15;
// Thumbnails and small previews are not a map anyone plans a stay on.
const MIN_MAP_WIDTH = 280;
// Below this a view covers too many squares to fetch, and dots would overlap.
const MIN_DATA_ZOOM = 11;
const MAX_SQUARES_PER_VIEW = 6;
const HOVER_REACH_PX = 8;
const POP_MARGIN = 8;
const POP_GAP = 14;
const TIP_GAP = 14;

const TRAIN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l2-4M15 21l-2-4"/><path d="M9 14h.01M15 14h.01"/></svg>';
const AREA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="9" r="5.5"/><circle cx="16" cy="15" r="5"/></svg>';

const AREAS_KEY = 'bfbAreasOn';
const AREA_KINDS_KEY = 'bfbAreaKinds';
const AREA_EVENTS_KEY = 'bfbAreaEvents';
// Below this the whole region is one smudge, so no areas show.
const MIN_AREA_ZOOM = 8;
// From here a label has room to say what the area is like as well as its name.
const TAG_ZOOM = 12;
const CHAR_PX = 6.6;
const PILL_H = 26;
// A label's coloured dots say what the area is, at a glance, without any words.
const MAX_KIND_DOTS = 3;

function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

function saveFlag(key: string, on: boolean): void {
  try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* storage blocked: the switch still works for this page */ }
}

function readOn(): boolean { return readFlag(STORE_KEY); }
function saveOn(on: boolean): void { saveFlag(STORE_KEY, on); }

function readKinds(): Set<AreaKind> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(AREA_KINDS_KEY) ?? '[]');
    return new Set(Array.isArray(saved) ? saved.filter((k): k is AreaKind => KIND_ORDER.includes(k)) : []);
  } catch { return new Set(); }
}

function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (a.lat - b.lat) * 111_320;
  const dLng = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

// The small part of Google's Maps API this plugin calls.
interface GLatLng { lat(): number; lng(): number }
interface GMouse { latLng?: GLatLng; domEvent?: MouseEvent }
interface GPoint { x: number; y: number }
interface GProjection {
  fromLatLngToDivPixel(p: GLatLng): GPoint | null;
  fromLatLngToContainerPixel(p: GLatLng): GPoint | null;
}
interface GOverlay {
  setMap(map: GMap | null): void;
  getPanes(): { overlayMouseTarget: HTMLElement } | null;
  getProjection(): GProjection | undefined;
}
interface GOverlayClass {
  new (): GOverlay;
  preventMapHitsAndGesturesFrom(el: HTMLElement): void;
}
interface GBounds { toJSON(): { south: number; west: number; north: number; east: number } }
interface GMap extends MapLike {
  getBounds(): GBounds | undefined;
  getCenter(): GLatLng | undefined;
  addListener(event: string, fn: (e: GMouse) => void): unknown;
  setOptions(opts: { draggableCursor?: string | null }): void;
  controls: { push(el: HTMLElement): void }[];
}
interface GPolyline { setMap(map: GMap | null): void }
interface GMaps {
  Circle?: new (opts: { center: { lat: number; lng: number }; radius: number; fillColor: string; fillOpacity: number; strokeColor: string; strokeOpacity: number; strokeWeight: number; zIndex: number; clickable: boolean }) => GPolyline;
  TransitLayer: new () => { setMap(map: GMap | null): void };
  OverlayView: GOverlayClass;
  LatLng: new (lat: number, lng: number) => GLatLng;
  Polyline: new (opts: { path: { lat: number; lng: number }[]; strokeColor: string; strokeWeight: number; strokeOpacity: number; zIndex: number; clickable: boolean }) => GPolyline;
  ControlPosition: { TOP_LEFT: number };
}

const gmaps = (): GMaps | undefined => (window as unknown as { google?: { maps?: GMaps } }).google?.maps;

let askCount = 0;

/** Asks the bridge for one stage of one square and waits for its answer. */
function requestArea(tile: Tile, stage: Stage): Promise<TransitArea> {
  const id = ++askCount;
  return new Promise((resolve, reject) => {
    const onAnswer = (e: MessageEvent) => {
      if (e.source !== window || e.data?.bfbTransit !== 'answer' || e.data.id !== id) return;
      window.removeEventListener('message', onAnswer);
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(JSON.parse(e.data.text));
    };
    window.addEventListener('message', onAnswer);
    window.postMessage({ bfbTransit: 'ask', id, tile: { ...tile }, stage }, location.origin);
  });
}

function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

function dotSize(zoom: number): number {
  if (zoom < 13) return 9;
  if (zoom < 15) return 12;
  return 15;
}

/** Adds the switch to one map and runs everything the switch turns on. */
function attach(map: GMap, g: GMaps): void {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(METRO_CSS);

  const makeHost = (mark: string) => {
    const host = document.createElement('div');
    host.setAttribute(mark, '');
    const root = host.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    return { host, root };
  };

  // The switch, in Google's own control layout.
  const control = makeHost('data-bfb-metro');
  const bar = document.createElement('div');
  bar.className = 'bar';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.innerHTML = `${TRAIN_ICON}<span>Metro</span>`;
  toggle.title = 'Show metro and rail lines and stations. Hover or click one for details';
  const status = document.createElement('span');
  status.className = 'status';
  status.hidden = true;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'retry';
  retry.textContent = 'Retry';
  retry.hidden = true;
  const areasToggle = document.createElement('button');
  areasToggle.type = 'button';
  areasToggle.dataset.areas = '';
  areasToggle.innerHTML = `${AREA_ICON}<span>Areas</span>`;
  areasToggle.title = 'Show what each part of the region is like, and what is on during the trip';
  bar.append(toggle, areasToggle, status, retry);
  const chips = document.createElement('div');
  chips.className = 'chips';
  chips.hidden = true;
  control.root.append(bar, chips);

  // The tip and popup float above everything and never move the map.
  const floating = makeHost('data-bfb-metro-layer');
  floating.host.style.cssText = 'position:absolute;inset:0;z-index:1000;pointer-events:none';
  const layer = document.createElement('div');
  layer.className = 'layer';
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  const pop = document.createElement('div');
  pop.className = 'pop';
  pop.hidden = true;
  const popTop = document.createElement('div');
  popTop.className = 'pop-top';
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = '‹';
  back.setAttribute('aria-label', 'Back');
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close');
  popTop.append(back, closeBtn);
  const popBody = document.createElement('div');
  popBody.style.cssText = 'display:flex;flex-direction:column;min-height:0';
  pop.append(popBody, popTop);
  layer.append(tip, pop);
  floating.root.append(layer);
  map.getDiv().append(floating.host);

  const dots = makeHost('data-bfb-metro-dots');
  const dotLayer = document.createElement('div');
  dotLayer.className = 'dots';
  // Labels sit under the station dots, so a station is never hidden by its area's name.
  const pillLayer = document.createElement('div');
  pillLayer.className = 'pills';
  dots.root.append(pillLayer, dotLayer);

  const transit = new g.TransitLayer();
  let on = false;
  let area: TransitArea = { routes: [], stations: [] };
  let lines: Line[] = [];
  let stations: Station[] = [];
  let index = new TrackIndex([]);
  const linesByStation = new Map<number, Line[]>();
  const dotEls = new Map<number, HTMLElement>();

  const center = () => {
    const c = map.getCenter();
    return c ? { lat: c.lat(), lng: c.lng() } : { lat: 0, lng: 0 };
  };

  // Highlight: the line under the pointer or on the open card, in its own colour.
  const lineShapes = new Map<string, GPolyline[]>();
  let hoverLine: Line | null = null;
  let openedLine: Line | null = null;
  const shapesFor = (line: Line) => {
    let shapes = lineShapes.get(line.key);
    if (!shapes) {
      shapes = line.paths.map(path => new g.Polyline({
        path: path.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: line.colour, strokeWeight: 6, strokeOpacity: 0.95, zIndex: 50, clickable: false,
      }));
      lineShapes.set(line.key, shapes);
    }
    return shapes;
  };
  const shown = new Set<Line>();
  const refreshHighlight = () => {
    const want = new Set([hoverLine, openedLine].filter((l): l is Line => !!l));
    for (const line of [...shown]) {
      if (!want.has(line)) { shapesFor(line).forEach(s => s.setMap(null)); shown.delete(line); }
    }
    for (const line of want) {
      if (!shown.has(line)) { shapesFor(line).forEach(s => s.setMap(map)); shown.add(line); }
    }
  };

  // The popup: a stack of cards, so a line opened from a station can go back.
  type View = { build: () => HTMLElement; at: { lat: number; lng: number }; line?: Line };
  let stack: View[] = [];
  let anchor: { lat: number; lng: number } | null = null;
  let activeDot: HTMLElement | null = null;

  const placePop = () => {
    if (pop.hidden || !anchor) return;
    const p = overlay.getProjection()?.fromLatLngToContainerPixel(new g.LatLng(anchor.lat, anchor.lng));
    if (!p) return;
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const boxW = layer.clientWidth;
    const boxH = layer.clientHeight;
    const above = p.y - POP_GAP - h >= POP_MARGIN || p.y > boxH / 2;
    const y = above ? p.y - POP_GAP - h : p.y + POP_GAP;
    pop.style.left = `${Math.max(POP_MARGIN, Math.min(boxW - w - POP_MARGIN, p.x - w / 2))}px`;
    pop.style.top = `${Math.max(POP_MARGIN, Math.min(boxH - h - POP_MARGIN, y))}px`;
  };

  const renderTop = () => {
    const view = stack[stack.length - 1];
    if (!view) return;
    popBody.replaceChildren(view.build());
    back.hidden = stack.length < 2;
    pop.classList.toggle('back', stack.length > 1);
    anchor = view.at;
    openedLine = view.line ?? null;
    refreshHighlight();
    pop.hidden = false;
    tip.hidden = true;
    placePop();
  };

  // A popup covers part of the map, and a tip for something hidden under it is noise.
  const underPopup = (x: number, y: number) => {
    if (pop.hidden) return false;
    const r = pop.getBoundingClientRect();
    const box = layer.getBoundingClientRect();
    return x >= r.left - box.left && x <= r.right - box.left && y >= r.top - box.top && y <= r.bottom - box.top;
  };

  const closePop = () => {
    stack = [];
    anchor = null;
    pop.hidden = true;
    openedLine = null;
    activeDot?.classList.remove('on');
    activeDot = null;
    markPill(null);
    refreshHighlight();
  };

  const stopsOnLine = new Map<string, Station[]>();
  const ctx: CardContext = {
    linesAt: s => linesByStation.get(s.id) ?? [],
    stopsOf: line => {
      let stops = stopsOnLine.get(line.key);
      if (!stops) { stops = stationsOnLine(line, stations); stopsOnLine.set(line.key, stops); }
      return stops;
    },
    openStation: s => {
      stack.push({ build: () => stationCard(s, ctx), at: { lat: s.lat, lng: s.lng } });
      markDot(s);
      renderTop();
    },
    openLine: line => {
      stack.push({ build: () => lineCard(line, ctx), at: anchor ?? center(), line });
      renderTop();
    },
  };

  const markDot = (s: Station | null) => {
    activeDot?.classList.remove('on');
    activeDot = s ? dotEls.get(s.id) ?? null : null;
    activeDot?.classList.add('on');
  };

  back.addEventListener('click', () => { stack.pop(); renderTop(); });
  closeBtn.addEventListener('click', closePop);
  // Booking closes its whole map on Esc, so an open popup takes the key first.
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || pop.hidden) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    closePop();
  }, true);
  // The map must not pan or zoom under a pointer that is working in the popup.
  for (const type of ['wheel', 'pointerdown', 'mousedown', 'dblclick', 'click', 'touchstart']) {
    pop.addEventListener(type, e => e.stopPropagation());
  }

  // The tip follows the pointer, flipping before it would leave the map.
  const showTip = (content: HTMLElement, x: number, y: number) => {
    if (underPopup(x, y)) { tip.hidden = true; return; }
    tip.replaceChildren(content);
    tip.hidden = false;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = x + TIP_GAP + w > layer.clientWidth ? x - TIP_GAP - w : x + TIP_GAP;
    const top = y + TIP_GAP + h > layer.clientHeight ? y - TIP_GAP - h : y + TIP_GAP;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.max(0, top)}px`;
  };

  const pointerIn = (ev: MouseEvent) => {
    const r = layer.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };

  // Station dots, drawn only for what is in view.
  const OverlayBase = g.OverlayView;
  class Dots extends OverlayBase {
    onAdd() {
      this.getPanes()?.overlayMouseTarget.append(dots.host);
      OverlayBase.preventMapHitsAndGesturesFrom(dots.host);
    }
    onRemove() { dots.host.remove(); }
    draw() { drawDots(this.getProjection()); drawAreas(this.getProjection()); placePop(); }
  }
  const overlay = new Dots();

  // Areas: a soft patch of colour on the map and a label to hover or click. The
  // patches let every click through, so the site's own pins keep working.
  let areasOn = false;
  const areaKinds = readKinds();
  let eventsOnly = readFlag(AREA_EVENTS_KEY);
  const pills = new Map<string, HTMLElement>();
  const patches = new Map<string, GPolyline>();
  let activePill: HTMLElement | null = null;

  const markPill = (p: HTMLElement | null) => {
    activePill?.classList.remove('on');
    activePill = p;
    activePill?.classList.add('on');
  };

  const openArea = (area: Area) => {
    const here = stations.filter(s => metresBetween(s, area) <= area.radiusM);
    markDot(null);
    stack = [{ build: () => areaCard(area, here, ctx), at: { lat: area.lat, lng: area.lng } }];
    renderTop();
    markPill(pills.get(area.id) ?? null);
  };

  const pillFor = (area: Area) => {
    let pill = pills.get(area.id);
    if (pill) return pill;
    pill = document.createElement('button');
    pill.className = 'pill';
    pill.dataset.area = area.id;
    pill.style.setProperty('--c', KIND_COLOUR[area.kinds[0]]);
    pill.setAttribute('aria-label', `${area.name}: ${area.tag}`);
    const dotsEl = document.createElement('span');
    dotsEl.className = 'pill-kinds';
    for (const k of area.kinds.slice(0, MAX_KIND_DOTS)) {
      const d = document.createElement('i');
      d.style.background = KIND_COLOUR[k];
      dotsEl.append(d);
    }
    const name = document.createElement('span');
    name.textContent = area.name;
    const tag = document.createElement('span');
    tag.className = 'pill-tag';
    tag.textContent = area.tag;
    pill.append(dotsEl, name, tag);
    if (area.events.length) {
      const n = document.createElement('span');
      n.className = 'pill-n';
      n.textContent = String(area.events.length);
      n.title = `${area.events.length} on during the trip`;
      pill.append(n);
    }
    pill.addEventListener('pointerenter', e => {
      if (pop.hidden || anchor?.lat !== area.lat) {
        const at = pointerIn(e);
        showTip(areaTip(area), at.x, at.y);
      }
    });
    pill.addEventListener('pointerleave', () => { tip.hidden = true; });
    pill.addEventListener('click', e => { e.stopPropagation(); openArea(area); });
    pillLayer.append(pill);
    pills.set(area.id, pill);
    return pill;
  };

  const drawAreas = (proj: GProjection | undefined) => {
    if (!proj) return;
    const zoom = map.getZoom() ?? 0;
    const b = map.getBounds()?.toJSON();
    const wanted = areasOn && zoom >= MIN_AREA_ZOOM && b ? filterAreas(AREAS, areaKinds, eventsOnly) : [];
    const keep = new Set(wanted.map(a => a.id));
    for (const [id, patch] of patches) {
      if (!keep.has(id)) { patch.setMap(null); patches.delete(id); }
    }
    for (const area of wanted) {
      // A map loaded without Google's shapes still gets the labels, which carry the meaning.
      if (patches.has(area.id) || !g.Circle) continue;
      const colour = KIND_COLOUR[area.kinds[0]];
      const patch = new g.Circle({
        center: { lat: area.lat, lng: area.lng }, radius: area.radiusM, fillColor: colour, fillOpacity: 0.24,
        strokeColor: colour, strokeOpacity: 0.6, strokeWeight: 1, zIndex: 5, clickable: false,
      });
      patch.setMap(map);
      patches.set(area.id, patch);
    }
    const withTag = zoom >= TAG_ZOOM;
    const boxes = [];
    const spots = new Map<string, GPoint>();
    for (const area of wanted) {
      if (!b || area.lat < b.south || area.lat > b.north || area.lng < b.west || area.lng > b.east) continue;
      const p = proj.fromLatLngToDivPixel(new g.LatLng(area.lat, area.lng));
      if (!p) continue;
      spots.set(area.id, p);
      const w = area.name.length * CHAR_PX + 34 + area.kinds.slice(0, MAX_KIND_DOTS).length * 10;
      boxes.push({ id: area.id, x: p.x, y: p.y, w, fullW: withTag ? w + (area.tag.length + 2) * CHAR_PX : w, h: PILL_H });
    }
    const fit = labelsThatFit(boxes);
    for (const [id, pill] of pills) {
      if (!fit.has(id)) pill.hidden = true;
    }
    for (const area of wanted) {
      const p = spots.get(area.id);
      if (!p || !fit.has(area.id)) continue;
      const pill = pillFor(area);
      pill.hidden = false;
      pill.style.left = `${p.x}px`;
      pill.style.top = `${p.y}px`;
      pill.querySelector<HTMLElement>('.pill-tag')!.hidden = !(withTag && fit.get(area.id));
    }
  };

  const chipFor = (label: string, colour: string, pressed: boolean, onPress: (next: boolean) => void) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = label;
    chip.style.setProperty('--c', colour);
    chip.setAttribute('aria-pressed', String(pressed));
    chip.addEventListener('click', () => {
      const next = chip.getAttribute('aria-pressed') !== 'true';
      chip.setAttribute('aria-pressed', String(next));
      onPress(next);
      if (pop.hidden === false && activePill) closePop();
      drawAreas(overlay.getProjection());
    });
    return chip;
  };
  for (const kind of KIND_ORDER) {
    chips.append(chipFor(KIND_WORD[kind], KIND_COLOUR[kind], areaKinds.has(kind), next => {
      if (next) areaKinds.add(kind); else areaKinds.delete(kind);
      try { localStorage.setItem(AREA_KINDS_KEY, JSON.stringify([...areaKinds])); } catch { /* storage blocked: the filter still works for this page */ }
    }));
  }
  chips.append(chipFor('Events', '#202124', eventsOnly, next => {
    eventsOnly = next;
    saveFlag(AREA_EVENTS_KEY, next);
  }));

  const syncOverlay = () => overlay.setMap(on || areasOn ? map : null);
  const applyAreas = (next: boolean) => {
    areasOn = next;
    areasToggle.setAttribute('aria-pressed', String(next));
    chips.hidden = !next;
    syncOverlay();
    if (!next) {
      if (activePill) closePop();
      patches.forEach(p => p.setMap(null));
      patches.clear();
      pills.forEach(p => p.remove());
      pills.clear();
      if (!on) tip.hidden = true;
    } else {
      drawAreas(overlay.getProjection());
    }
  };
  areasToggle.addEventListener('click', () => { saveFlag(AREAS_KEY, !areasOn); applyAreas(!areasOn); });

  const drawDots = (proj: GProjection | undefined) => {
    if (!proj) return;
    const zoom = map.getZoom() ?? 0;
    const b = map.getBounds()?.toJSON();
    const showing = on && zoom >= MIN_DATA_ZOOM && b;
    const seen = new Set<number>();
    if (showing) {
      dotLayer.style.setProperty('--size', `${dotSize(zoom)}px`);
      for (const s of stations) {
        if (s.lat < b.south || s.lat > b.north || s.lng < b.west || s.lng > b.east) continue;
        const p = proj.fromLatLngToDivPixel(new g.LatLng(s.lat, s.lng));
        if (!p) continue;
        seen.add(s.id);
        const dot = dotEls.get(s.id) ?? makeDot(s);
        dot.style.left = `${p.x}px`;
        dot.style.top = `${p.y}px`;
      }
    }
    for (const [id, dot] of dotEls) {
      if (!seen.has(id)) { dot.remove(); dotEls.delete(id); }
    }
  };

  // A one-line station wears its line's colour; an interchange gets a heavier dark ring.
  const styleDot = (dot: HTMLElement, s: Station) => {
    const served = linesByStation.get(s.id) ?? [];
    dot.classList.toggle('hub', served.length > 1);
    dot.style.setProperty('--ring', served.length === 1 ? served[0].colour : '#202124');
  };

  const makeDot = (s: Station) => {
    const dot = document.createElement('div');
    dot.className = 'dot';
    styleDot(dot, s);
    dot.dataset.station = String(s.id);
    dot.tabIndex = 0;
    dot.setAttribute('role', 'button');
    dot.setAttribute('aria-label', `${s.name} station`);
    dot.addEventListener('pointerenter', e => {
      if (pop.hidden || anchor?.lat !== s.lat) {
        const at = pointerIn(e);
        showTip(stationTip(s, linesByStation.get(s.id) ?? []), at.x, at.y);
      }
    });
    dot.addEventListener('pointerleave', () => { tip.hidden = true; });
    const open = (e: Event) => {
      e.stopPropagation();
      stack = [];
      ctx.openStation(s);
    };
    dot.addEventListener('click', open);
    dot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } });
    dotLayer.append(dot);
    dotEls.set(s.id, dot);
    return dot;
  };

  const redraw = () => drawDots(overlay.getProjection());

  // Whatever is known so far becomes lines, stations and the hover index.
  const rebuild = () => {
    shown.forEach(line => shapesFor(line).forEach(s => s.setMap(null)));
    shown.clear();
    lineShapes.clear();
    hoverLine = null;
    lines = groupLines(area.routes);
    stations = mergeStations(area.stations);
    index = new TrackIndex(lines);
    linesByStation.clear();
    stopsOnLine.clear();
    for (const s of stations) linesByStation.set(s.id, linesAtStation(s, lines));
    // Dots are updated, not replaced: a click in progress must still land.
    const known = new Map(stations.map(s => [s.id, s]));
    for (const [id, dot] of dotEls) {
      const s = known.get(id);
      if (s) styleDot(dot, s);
      else { dot.remove(); dotEls.delete(id); }
    }
    redraw();
    refreshHighlight();
    if (!pop.hidden) renderTop();
  };

  // Fetching: one request at a time. Every square's stations come first, because
  // they answer in seconds, then metro lines, then trains.
  const loaded = new Set<string>();
  const failed = new Set<string>();
  let loading = false;

  const setStatus = (text: string, canRetry = false) => {
    status.textContent = text;
    status.hidden = !text;
    retry.hidden = !canRetry;
  };

  const showDataState = () => {
    if (!on) { setStatus(''); return; }
    if (loading) return;
    if ((map.getZoom() ?? 0) < MIN_DATA_ZOOM) setStatus('Zoom in for stations');
    else if (failed.size) setStatus(stations.length ? "Couldn't load all lines" : "Couldn't load stations", true);
    else setStatus('');
  };

  const nextRequest = (tiles: Tile[]) => {
    for (const stage of STAGES) {
      for (const tile of tiles) {
        const id = `${tile.key}|${stage}`;
        if (!loaded.has(id) && !failed.has(id)) return { tile, stage, id };
      }
    }
    return null;
  };

  const loadView = async () => {
    if (loading || !on || (map.getZoom() ?? 0) < MIN_DATA_ZOOM) { showDataState(); return; }
    const b = map.getBounds()?.toJSON();
    if (!b) return;
    const next = nextRequest(tilesFor(b).slice(0, MAX_SQUARES_PER_VIEW));
    if (!next) { showDataState(); return; }
    loading = true;
    setStatus(next.stage === 'stations' ? 'Loading stations…' : 'Loading lines…');
    try {
      area = mergeArea(area, await requestArea(next.tile, next.stage));
      loaded.add(next.id);
      rebuild();
    } catch (err) {
      failed.add(next.id);
      console.warn('[bfb] metro data', err);
    } finally {
      loading = false;
      void loadView();
    }
  };

  retry.addEventListener('click', () => { failed.clear(); void loadView(); });

  // Hovering and clicking on track.
  const linesUnder = (at: GLatLng) => {
    const reach = HOVER_REACH_PX * metresPerPixel(at.lat(), map.getZoom() ?? 13);
    return index.near(at.lat(), at.lng(), reach);
  };

  let moveQueued: GMouse | null = null;
  let frame = 0;
  const handleMove = () => {
    frame = 0;
    const e = moveQueued;
    moveQueued = null;
    if (!on || !e?.latLng) return;
    const near = linesUnder(e.latLng);
    const next = near[0] ?? null;
    if (next !== hoverLine) { hoverLine = next; refreshHighlight(); }
    map.setOptions({ draggableCursor: next ? 'pointer' : null });
    if (next && e.domEvent) {
      const at = pointerIn(e.domEvent);
      showTip(lineTip(near), at.x, at.y);
    } else {
      tip.hidden = true;
    }
  };

  map.addListener('mousemove', e => {
    moveQueued = e;
    if (!frame) frame = requestAnimationFrame(handleMove);
  });

  map.addListener('click', e => {
    if (!pop.hidden && !on) closePop();
    if (!on || !e.latLng) return;
    const near = linesUnder(e.latLng);
    closePop();
    if (!near.length) return;
    const at = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    anchor = at;
    if (near.length === 1) stack = [{ build: () => lineCard(near[0], ctx), at, line: near[0] }];
    else stack = [{ build: () => chooserCard(near, ctx), at }];
    renderTop();
  });

  map.addListener('idle', () => { if (on) void loadView(); });

  const apply = (next: boolean) => {
    on = next;
    toggle.setAttribute('aria-pressed', String(on));
    transit.setMap(on ? map : null);
    syncOverlay();
    if (!on) {
      closePop();
      hoverLine = null;
      refreshHighlight();
      tip.hidden = true;
      map.setOptions({ draggableCursor: null });
      dotEls.forEach(dot => dot.remove());
      dotEls.clear();
      setStatus('');
    } else {
      void loadView();
    }
  };

  toggle.addEventListener('click', () => { saveOn(!on); apply(!on); });
  map.controls[g.ControlPosition.TOP_LEFT].push(control.host);
  apply(readOn());
  applyAreas(readFlag(AREAS_KEY));
}

/**
 * Watches the page for maps and adds the switch to each.
 *
 * Both sites build and drop their map as the visitor opens and closes it, so
 * this keeps looking for the life of the page. The check is one selector a
 * second; the tree walk only runs for a map not yet settled, and gives up on an
 * element after a few tries.
 */
export function startMetro(): void {
  const tries = new WeakMap<Element, number>();
  const check = () => {
    const g = gmaps();
    if (!g?.TransitLayer || !g.OverlayView) return;
    for (const el of document.querySelectorAll('.gm-style')) {
      const count = tries.get(el) ?? 0;
      if (count >= MAX_TRIES) continue;
      if (el.getBoundingClientRect().width < MIN_MAP_WIDTH) continue;
      const found = findMapFor(el);
      if (!found) { tries.set(el, count + 1); continue; }
      tries.set(el, MAX_TRIES);
      attach(found as GMap, g);
    }
  };
  check();
  setInterval(check, CHECK_MS);
}
