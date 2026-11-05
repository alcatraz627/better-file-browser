// What the metro overlay shows about a station or a line: the hover tip and the
// popup's cards. Everything a person wants is on the card itself, with Google
// Maps as the last step rather than the first.

import { KIND_COLOUR, KIND_WORD, TRIP_LABEL, type Area, type TripEvent } from './site-areas-data';
import { eventDates } from './site-areas-model';
import { lineMapsUrl, stationMapsUrl, type Line, type Station } from './site-transit-data';

/** How a card reaches the rest of the overlay. */
export interface CardContext {
  linesAt(station: Station): Line[];
  stopsOf(line: Line): Station[];
  openStation(station: Station): void;
  openLine(line: Line): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** A line's code in its own colour, or a plain colour dot when it has no code. */
function lineBadge(line: Line): HTMLElement {
  const badge = el('span', 'badge', line.ref && line.ref.length <= 5 ? line.ref : '');
  badge.style.setProperty('--line', line.colour);
  return badge;
}

function fact(label: string, value: string): HTMLElement {
  const row = el('div', 'fact');
  row.append(el('span', 'fact-label', label), el('span', 'fact-value', value));
  return row;
}

function mapsButton(href: string, label: string): HTMLElement {
  const a = el('a', 'maps', label);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function credit(): HTMLElement {
  const a = el('a', 'credit', 'Data © OpenStreetMap');
  a.href = 'https://www.openstreetmap.org/copyright';
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function lineRow(line: Line, ctx: CardContext): HTMLElement {
  const row = el('button', 'row');
  row.type = 'button';
  const text = el('span', 'row-text');
  text.append(el('span', 'row-name', line.name));
  if (line.ends) text.append(el('span', 'row-sub', line.ends));
  row.append(lineBadge(line), text);
  row.addEventListener('click', () => ctx.openLine(line));
  return row;
}

const MODE_WORD: Record<string, string> = {
  subway: 'Metro line', light_rail: 'Light rail line', monorail: 'Monorail', tram: 'Tram line', train: 'Train line',
};

export function stationCard(station: Station, ctx: CardContext): HTMLElement {
  const card = el('div', 'card');
  card.dataset.card = 'station';
  card.append(el('div', 'title', station.name));
  if (station.local) card.append(el('div', 'local', station.local));
  card.append(el('div', 'sub', station.kind));
  const facts = el('div', 'facts');
  if (station.operator) facts.append(fact('Run by', station.operator));
  if (station.codes?.length) facts.append(fact('Codes', station.codes.join(', ')));
  if (station.stepFree) facts.append(fact('Access', 'Step-free'));
  if (facts.childElementCount) card.append(facts);
  const lines = ctx.linesAt(station);
  if (lines.length) {
    card.append(el('div', 'heading', lines.length === 1 ? '1 line' : `${lines.length} lines`));
    const list = el('div', 'list');
    for (const line of lines) list.append(lineRow(line, ctx));
    card.append(list);
  }
  card.append(mapsButton(stationMapsUrl(station), 'Open in Google Maps'), credit());
  return card;
}

export function lineCard(line: Line, ctx: CardContext): HTMLElement {
  const card = el('div', 'card');
  card.dataset.card = 'line';
  const head = el('div', 'line-head');
  head.append(lineBadge(line), el('div', 'title', line.name));
  card.append(head);
  if (line.local) card.append(el('div', 'local', line.local));
  card.append(el('div', 'sub', MODE_WORD[line.mode] ?? 'Rail line'));
  const facts = el('div', 'facts');
  if (line.ends) facts.append(fact('Runs', line.ends));
  if (line.operator) facts.append(fact('Run by', line.operator));
  if (line.hours) facts.append(fact('Hours', line.hours));
  if (line.everyMin) facts.append(fact('Trains', `About every ${line.everyMin} min`));
  if (facts.childElementCount) card.append(facts);
  const stops = ctx.stopsOf(line);
  if (stops.length) {
    const whole = line.stops.length;
    const heading = whole > stops.length ? `${stops.length} of ${whole} stops, in this area` : `${stops.length} stops`;
    card.append(el('div', 'heading', heading));
    const list = el('div', 'list');
    for (const s of stops) {
      const row = el('button', 'row stop');
      row.type = 'button';
      row.append(el('span', 'stop-dot'), el('span', 'row-name', s.name));
      row.style.setProperty('--line', line.colour);
      row.addEventListener('click', () => ctx.openStation(s));
      list.append(row);
    }
    card.append(list);
  }
  card.append(mapsButton(lineMapsUrl(line), 'See this area on Google Maps'), credit());
  return card;
}

/** Shown when a click lands where several lines share one track. */
export function chooserCard(lines: Line[], ctx: CardContext): HTMLElement {
  const card = el('div', 'card');
  card.dataset.card = 'chooser';
  card.append(el('div', 'title', `${lines.length} lines here`));
  const list = el('div', 'list');
  for (const line of lines) list.append(lineRow(line, ctx));
  card.append(list);
  return card;
}

function eventRow(e: TripEvent): HTMLElement {
  const row = el('a', 'event');
  row.href = e.source;
  row.target = '_blank';
  row.rel = 'noopener';
  row.append(el('span', 'event-date', eventDates(e)), el('span', 'event-name', e.name));
  row.append(el('span', 'event-note', e.hours ? `${e.note} ${e.hours}.` : e.note));
  if (!e.sure) row.append(el('span', 'event-unsure', 'Dates from past years, check before relying on it'));
  return row;
}

/** What an area is like and what is on there during the trip. */
export function areaCard(area: Area, stationsHere: Station[], ctx: CardContext): HTMLElement {
  const card = el('div', 'card');
  card.dataset.card = 'area';
  card.append(el('div', 'title', area.name), el('div', 'sub', area.tag), el('div', 'feel', area.feel));
  const kinds = el('div', 'kinds');
  for (const k of area.kinds) {
    const chip = el('span', 'kind', KIND_WORD[k]);
    chip.style.setProperty('--c', KIND_COLOUR[k]);
    kinds.append(chip);
  }
  card.append(kinds);
  if (area.events.length) {
    card.append(el('div', 'heading', `On during ${TRIP_LABEL}`));
    const list = el('div', 'list');
    for (const e of area.events) list.append(eventRow(e));
    card.append(list);
  } else {
    card.append(el('div', 'heading', `Nothing special found for ${TRIP_LABEL}`));
  }
  if (stationsHere.length) {
    card.append(el('div', 'heading', stationsHere.length === 1 ? '1 station here' : `${stationsHere.length} stations here`));
    const list = el('div', 'list');
    for (const s of stationsHere) {
      const row = el('button', 'row stop');
      row.type = 'button';
      row.append(el('span', 'stop-dot'), el('span', 'row-name', s.name));
      row.style.setProperty('--line', ctx.linesAt(s)[0]?.colour ?? '#5f6368');
      row.addEventListener('click', () => ctx.openStation(s));
      list.append(row);
    }
    card.append(list);
  }
  return card;
}

export function areaTip(area: Area): HTMLElement {
  const tip = el('div', 'tip-body');
  tip.append(el('div', 'tip-title', area.name), el('div', '', area.feel));
  const count = area.events.length;
  if (count) tip.append(el('div', 'tip-more', `${count} ${count === 1 ? 'event' : 'events'}: ${area.events[0].name}${count > 1 ? ' and more' : ''}`));
  return tip;
}

const TIP_LINES = 3;

export function lineTip(lines: Line[]): HTMLElement {
  const tip = el('div', 'tip-body');
  for (const line of lines.slice(0, TIP_LINES)) {
    const row = el('div', 'tip-row');
    row.append(lineBadge(line), el('span', '', line.name));
    tip.append(row);
  }
  if (lines.length > TIP_LINES) tip.append(el('div', 'tip-more', `and ${lines.length - TIP_LINES} more`));
  return tip;
}

export function stationTip(station: Station, lines: Line[]): HTMLElement {
  const tip = el('div', 'tip-body');
  tip.append(el('div', 'tip-title', station.name));
  if (lines.length) {
    const badges = el('div', 'tip-badges');
    for (const line of lines.slice(0, 8)) badges.append(lineBadge(line));
    tip.append(badges);
  }
  return tip;
}

export const METRO_CSS = `
:host { all: initial; font: 400 13px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #202124; }
.bar { display: inline-flex; align-items: stretch; margin: 12px 0 0 32px; border-radius: 8px; background: #fff; color: #202124; box-shadow: 0 1px 4px rgba(0,0,0,.3); overflow: hidden; font-weight: 500; }
.bar button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; cursor: pointer; white-space: nowrap; }
.bar button:hover { background: #f1f3f4; }
.bar button:focus-visible { outline: 2px solid #1a73e8; outline-offset: -2px; }
.bar button[aria-pressed="true"] { background: #1a73e8; color: #fff; }
.bar button[aria-pressed="true"]:hover { background: #1765cc; }
.bar svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.status { display: flex; align-items: center; padding: 0 10px; color: #5f6368; font-weight: 400; white-space: nowrap; }
.status[hidden], .bar button[hidden] { display: none; }
.bar button.retry { color: #1a56c4; }

.layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.tip { position: absolute; max-width: 260px; padding: 6px 9px; border-radius: 6px; background: #202124; color: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.35); pointer-events: none; }
.tip[hidden], .pop[hidden] { display: none; }
.tip-row { display: flex; align-items: center; gap: 6px; }
.tip-row + .tip-row { margin-top: 4px; }
.tip-title { font-weight: 600; }
.tip-badges { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
.tip-more { margin-top: 4px; color: #bdc1c6; }

.badge { flex: none; display: inline-flex; align-items: center; justify-content: center; min-width: 12px; height: 18px; padding: 0 4px; border-radius: 9px; background: var(--line); color: #fff; font-size: 11px; font-weight: 700; text-shadow: 0 0 2px rgba(0,0,0,.65); box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); box-sizing: border-box; }
.badge:empty { width: 12px; height: 12px; padding: 0; border-radius: 50%; }
.row > .badge { min-width: 30px; }
.row > .badge:empty { min-width: 12px; margin: 0 9px; }

.pop { position: absolute; width: 280px; max-height: min(420px, calc(100% - 16px)); display: flex; flex-direction: column; border-radius: 10px; background: #fff; color: #202124; box-shadow: 0 3px 14px rgba(0,0,0,.35); pointer-events: auto; overflow: hidden; }
.pop-top { position: absolute; top: 6px; right: 6px; left: 6px; display: flex; justify-content: space-between; pointer-events: none; }
.pop-top button { all: unset; pointer-events: auto; display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; background: #fff; color: #5f6368; font-size: 18px; line-height: 1; cursor: pointer; }
.pop-top button:hover { background: #f1f3f4; }
.pop-top button:focus-visible { outline: 2px solid #1a73e8; }
.pop-top button[hidden] { visibility: hidden; }
.card { display: flex; flex-direction: column; min-height: 0; padding: 12px 14px 8px; overflow-y: auto; }
.pop.back .card { padding-top: 34px; }
.line-head { display: flex; align-items: center; gap: 8px; padding-right: 22px; }
.title { font-size: 15px; font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; }
.card > .title { padding-right: 22px; }
.local { margin-top: 1px; color: #5f6368; }
.sub { margin-top: 2px; color: #5f6368; }
.facts { display: grid; gap: 3px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e8eaed; }
.fact { display: grid; grid-template-columns: 52px 1fr; gap: 6px; }
.fact-label { color: #5f6368; }
.fact-value { overflow-wrap: anywhere; }
.heading { margin-top: 10px; color: #5f6368; font-size: 12px; font-weight: 600; }
.list { display: flex; flex-direction: column; margin: 3px -6px 0; }
.row { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 6px; cursor: pointer; }
.row:hover { background: #f1f3f4; }
.row:focus-visible { outline: 2px solid #1a73e8; outline-offset: -2px; }
.row-text { display: flex; flex-direction: column; min-width: 0; }
.row-name { overflow-wrap: anywhere; }
.row-sub { color: #5f6368; font-size: 12px; overflow-wrap: anywhere; }
.row.stop { padding-top: 3px; padding-bottom: 3px; }
.stop-dot { flex: none; width: 9px; height: 9px; border-radius: 50%; background: #fff; border: 2.5px solid var(--line); box-sizing: border-box; }
.maps { flex: none; display: block; margin-top: 10px; padding: 7px 10px; border-radius: 6px; background: #1a73e8; color: #fff; font-weight: 500; text-align: center; text-decoration: none; }
.maps:hover { background: #1765cc; }
.maps:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
.credit { flex: none; margin-top: 6px; color: #80868b; font-size: 11px; text-align: center; text-decoration: none; }
.credit:hover { text-decoration: underline; }

.dots { position: absolute; left: 0; top: 0; }
.dot { position: absolute; box-sizing: border-box; width: var(--size); height: var(--size); margin: calc(var(--size) / -2) 0 0 calc(var(--size) / -2); border-radius: 50%; background: #fff; border: 2.5px solid var(--ring); box-shadow: 0 0 0 1px rgba(255,255,255,.9), 0 1px 3px rgba(0,0,0,.4); cursor: pointer; }
.dot::after { content: ""; position: absolute; inset: -6px; border-radius: 50%; }
.dot.hub { border-width: 3px; }
.dot:hover, .dot.on { transform: scale(1.35); }
.dot:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }

.chips { display: flex; flex-wrap: wrap; gap: 4px; max-width: 300px; margin: 6px 0 0 32px; }
.chips[hidden] { display: none; }
.chip { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: 12px; background: #fff; color: #202124; box-shadow: 0 1px 3px rgba(0,0,0,.3); font-size: 12px; cursor: pointer; white-space: nowrap; }
.chip::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.chip:hover { background: #f1f3f4; }
.chip:focus-visible { outline: 2px solid #1a73e8; }
.chip[aria-pressed="true"] { background: #202124; color: #fff; }

.pills { position: absolute; left: 0; top: 0; }
.pill { all: unset; position: absolute; box-sizing: border-box; display: flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 11px; background: rgba(255,255,255,.94); color: #202124; box-shadow: 0 0 0 1.5px var(--c), 0 1px 3px rgba(0,0,0,.3); font: 600 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; white-space: nowrap; cursor: pointer; transform: translate(-50%, -50%); }
.pill[hidden] { display: none; }
.pill.rough, .pill.rough:hover, .pill.rough.on { width: 12px; height: 12px; padding: 0; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 1.5px #fff, 0 1px 3px rgba(0,0,0,.4); }
.pill.rough:hover, .pill.rough.on { width: 16px; height: 16px; }
.pill.rough > * { display: none; }
.pill:hover, .pill.on { background: #fff; z-index: 2; box-shadow: 0 0 0 2px var(--c), 0 2px 6px rgba(0,0,0,.4); }
.pill:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
.pill-kinds { display: inline-flex; gap: 2px; }
.pill-kinds i { width: 8px; height: 8px; border-radius: 50%; }
.pill-tag { color: #5f6368; font-weight: 400; }
.pill-n { display: inline-flex; align-items: center; justify-content: center; min-width: 15px; height: 15px; padding: 0 3px; box-sizing: border-box; border-radius: 8px; background: #202124; color: #fff; font-size: 10px; font-weight: 700; }

.feel { margin-top: 8px; }
.kinds { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.kind { display: inline-flex; align-items: center; gap: 4px; color: #5f6368; font-size: 12px; }
.kind::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.kind + .kind { margin-left: 4px; }
.event { display: flex; flex-direction: column; gap: 1px; padding: 6px; border-radius: 6px; color: inherit; text-decoration: none; }
.event:hover { background: #f1f3f4; }
.event:focus-visible { outline: 2px solid #1a73e8; outline-offset: -2px; }
.event-date { color: #1a56c4; font-size: 12px; font-weight: 600; }
.event-name { font-weight: 600; overflow-wrap: anywhere; }
.event-note { color: #5f6368; font-size: 12px; overflow-wrap: anywhere; }
.event-unsure { color: #b45309; font-size: 12px; }
`;
